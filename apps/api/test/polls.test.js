/**
 * Polls.
 *
 * The screen has always told residents that "results are visible after you
 * vote". While polls lived in the browser that was a decoration — every tally
 * was already in memory. The assertions here are mostly about that promise
 * being real, and about one vote per person being enforced by the database
 * rather than by the client's good manners.
 */
import "./setup.js";
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post, del, login, ACCOUNTS } from "./helpers.js";

describe("polls", () => {
  let secretary, treasurer, resident, other, guard;
  let poll;

  const board = async (token) => (await get("/api/polls", token)).body.polls;
  const find = async (token, id) => (await board(token)).find((p) => p.id === id);

  before(async () => {
    await startTestServer();
    secretary = await login(ACCOUNTS.secretary);
    treasurer = await login(ACCOUNTS.treasurer);
    resident = await login(ACCOUNTS.resident);
    other = await login(ACCOUNTS.otherResident);
    guard = await login(ACCOUNTS.guard);

    const created = await post("/api/polls", {
      question: "Should we install EV charging points in the basement?",
      options: ["Yes — 4 points in P1", "Yes — but only 2 to start", "No — not yet"],
      days: 7,
    }, secretary.accessToken);
    assert.equal(created.status, 201);
    poll = created.body.poll;
  });

  after(stopTestServer);

  test("a resident cannot create one", async () => {
    const { status } = await post("/api/polls", { question: "Free parking for me?", options: ["Yes", "Also yes"] }, resident.accessToken);
    assert.equal(status, 403);
  });

  test("two options that say the same thing are refused", async () => {
    const { status } = await post("/api/polls", { question: "Pick a slot", options: ["Sunday", " sunday "] }, secretary.accessToken);
    assert.equal(status, 422);
  });

  test("a poll needs at least two options", async () => {
    const { status } = await post("/api/polls", { question: "Anything?", options: ["Only one"] }, secretary.accessToken);
    assert.equal(status, 422);
  });

  test("results are hidden until you vote", async () => {
    const seen = await find(resident.accessToken, poll.id);
    assert.equal(seen.resultsHidden, true);
    assert.equal(seen.total, null, "not even the turnout");
    assert.ok(seen.options.every((o) => o.votes === null), "and no tally reaches the browser at all");
    assert.equal(seen.myVote, null);
  });

  test("voting reveals them", async () => {
    const optionId = poll.options[0].id;
    const { status, body } = await post(`/api/polls/${poll.id}/vote`, { optionId }, resident.accessToken);
    assert.equal(status, 200);
    assert.equal(body.poll.resultsHidden, false);
    assert.equal(body.poll.myVote, optionId);
    assert.equal(body.poll.total, 1);
    assert.equal(body.poll.options.find((o) => o.id === optionId).votes, 1);
  });

  test("someone who has not voted still sees nothing", async () => {
    const seen = await find(other.accessToken, poll.id);
    assert.equal(seen.resultsHidden, true, "one resident voting does not open the results to the rest");
    assert.equal(seen.total, null);
  });

  test("one vote per person, however many times they tap", async () => {
    const [a, b] = poll.options;
    await post(`/api/polls/${poll.id}/vote`, { optionId: a.id }, other.accessToken);
    await post(`/api/polls/${poll.id}/vote`, { optionId: a.id }, other.accessToken);
    const seen = await find(other.accessToken, poll.id);
    assert.equal(seen.total, 2, "the resident and this one — not three");
    assert.equal(seen.options.find((o) => o.id === a.id).votes, 2);
  });

  test("changing your mind moves the vote rather than adding one", async () => {
    const [a, b] = poll.options;
    await post(`/api/polls/${poll.id}/vote`, { optionId: b.id }, other.accessToken);
    const seen = await find(other.accessToken, poll.id);
    assert.equal(seen.total, 2, "still two people");
    assert.equal(seen.options.find((o) => o.id === a.id).votes, 1);
    assert.equal(seen.options.find((o) => o.id === b.id).votes, 1);
    assert.equal(seen.myVote, b.id);
  });

  test("a guard on the society's staff may vote too", async () => {
    const { status } = await post(`/api/polls/${poll.id}/vote`, { optionId: poll.options[2].id }, guard.accessToken);
    assert.equal(status, 200, "everyone on the register has a say");
  });

  test("an option from another poll is refused", async () => {
    const second = await post("/api/polls", { question: "Clubhouse deep-clean slot?", options: ["Saturday", "Sunday"] }, treasurer.accessToken);
    const foreign = second.body.poll.options[0].id;
    const { status } = await post(`/api/polls/${poll.id}/vote`, { optionId: foreign }, resident.accessToken);
    assert.equal(status, 422);
  });

  test("the committee can close a poll early, which reveals the result", async () => {
    const closed = await post(`/api/polls/${poll.id}/close`, {}, treasurer.accessToken);
    assert.equal(closed.status, 200);
    assert.equal(closed.body.poll.closed, true);

    /* Someone who never voted now sees the outcome, because it is decided. */
    const seen = await find(other.accessToken, poll.id);
    assert.equal(seen.resultsHidden, false);
    assert.equal(seen.total, 3);
  });

  test("a closed poll cannot be voted in", async () => {
    const { status } = await post(`/api/polls/${poll.id}/vote`, { optionId: poll.options[0].id }, resident.accessToken);
    assert.equal(status, 409);
  });

  test("a resident can neither close nor delete one", async () => {
    assert.equal((await post(`/api/polls/${poll.id}/close`, {}, resident.accessToken)).status, 403);
    assert.equal((await del(`/api/polls/${poll.id}`, resident.accessToken)).status, 403);
  });

  test("deleting takes its votes with it", async () => {
    assert.equal((await del(`/api/polls/${poll.id}`, secretary.accessToken)).status, 204);
    assert.equal(await find(resident.accessToken, poll.id), undefined);
  });
});

/**
 * The notice board.
 *
 * The board used to live in each browser's local storage, which looked like it
 * worked: post as the secretary, sign out, sign back in as a resident on that
 * same browser, and the notice was there. It was there because the browser
 * still held it, not because it had been published. The first assertion below
 * is the one that distinguishes those two — a notice posted by one account,
 * read by a different account through a different session.
 */
import "./setup.js";
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post, patch, del, login, ACCOUNTS } from "./helpers.js";

describe("notices", () => {
  let secretary, treasurer, resident, guard;
  let noticeId;

  before(async () => {
    await startTestServer();
    secretary = await login(ACCOUNTS.secretary);
    treasurer = await login(ACCOUNTS.treasurer);
    resident = await login(ACCOUNTS.resident);
    guard = await login(ACCOUNTS.guard);
  });

  after(stopTestServer);

  test("a notice posted by the committee is visible to a resident", async () => {
    const posted = await post("/api/notices", {
      kind: "notice", title: "Water tank cleaning on Saturday",
      body: "Overhead tanks will be cleaned from 10am. Please store water.",
      priority: "high", pinned: true,
    }, secretary.accessToken);
    assert.equal(posted.status, 201);
    noticeId = posted.body.notice.id;

    /* A different account, a different session, a different token — the case
       that a browser-local board cannot satisfy. */
    const { body } = await get("/api/notices", resident.accessToken);
    const seen = body.notices.find((n) => n.id === noticeId);
    assert.ok(seen, "the resident sees a notice they did not post");
    assert.equal(seen.title, "Water tank cleaning on Saturday");
    assert.equal(seen.author, "Suresh Joshi", "and who wrote it");
  });

  test("a resident cannot post one", async () => {
    const { status } = await post("/api/notices", { title: "Free parking for me", body: "Signed, a resident" }, resident.accessToken);
    assert.equal(status, 403);
  });

  test("a guard cannot post one either", async () => {
    assert.equal((await post("/api/notices", { title: "Gate closed", body: "..." }, guard.accessToken)).status, 403);
  });

  test("the author has already read their own notice", async () => {
    const { body } = await get("/api/notices", secretary.accessToken);
    const mine = body.notices.find((n) => n.id === noticeId);
    assert.equal(mine.read, true, "otherwise the committee sees an unread badge for what they just wrote");
    assert.equal(mine.readCount, 1);
  });

  test("it is unread for everyone else until they open it", async () => {
    let board = await get("/api/notices", resident.accessToken);
    assert.equal(board.body.notices.find((n) => n.id === noticeId).read, false);

    assert.equal((await post(`/api/notices/${noticeId}/read`, {}, resident.accessToken)).status, 204);

    board = await get("/api/notices", resident.accessToken);
    const after = board.body.notices.find((n) => n.id === noticeId);
    assert.equal(after.read, true);
    assert.equal(after.readCount, 2, "the author and the resident");
  });

  test("reading twice counts once", async () => {
    await post(`/api/notices/${noticeId}/read`, {}, resident.accessToken);
    const { body } = await get("/api/notices", resident.accessToken);
    assert.equal(body.notices.find((n) => n.id === noticeId).readCount, 2, "scrolling past it again is not a second read");
  });

  test("a resident may comment, and everyone sees it", async () => {
    const { status } = await post(`/api/notices/${noticeId}/comments`, { body: "Will the tanker be at the back gate?" }, resident.accessToken);
    assert.equal(status, 201);

    const { body } = await get("/api/notices", treasurer.accessToken);
    const seen = body.notices.find((n) => n.id === noticeId);
    assert.equal(seen.comments.length, 1);
    assert.equal(seen.comments[0].body, "Will the tanker be at the back gate?");
    assert.equal(seen.comments[0].author, "Rahul Mehta", "attributed to a person, not an id");
  });

  test("a reaction is one person's, and tapping again takes it back", async () => {
    await post(`/api/notices/${noticeId}/reactions`, { emoji: "👍" }, resident.accessToken);
    await post(`/api/notices/${noticeId}/reactions`, { emoji: "👍" }, treasurer.accessToken);
    /* The same person reacting twice must not move the count. */
    await post(`/api/notices/${noticeId}/reactions`, { emoji: "👍" }, resident.accessToken);

    let { body } = await get("/api/notices", resident.accessToken);
    let seen = body.notices.find((n) => n.id === noticeId);
    assert.equal(seen.reactions["👍"], 1, "the resident took theirs back; the treasurer's remains");
    assert.deepEqual(seen.myReactions, [], "and the screen knows it is no longer theirs");

    await post(`/api/notices/${noticeId}/reactions`, { emoji: "👍" }, resident.accessToken);
    ({ body } = await get("/api/notices", resident.accessToken));
    seen = body.notices.find((n) => n.id === noticeId);
    assert.equal(seen.reactions["👍"], 2);
    assert.deepEqual(seen.myReactions, ["👍"]);
  });

  test("pinned notices come first", async () => {
    await post("/api/notices", { title: "Lift servicing", body: "Tuesday morning." }, secretary.accessToken);
    const { body } = await get("/api/notices", resident.accessToken);
    assert.equal(body.notices[0].id, noticeId, "the pinned one leads the board");
  });

  test("the committee can unpin and edit", async () => {
    const { status, body } = await patch(`/api/notices/${noticeId}`, { pinned: false, title: "Water tank cleaning — Saturday 10am" }, treasurer.accessToken);
    assert.equal(status, 200);
    assert.equal(body.notice.pinned, false);
    assert.equal(body.notice.title, "Water tank cleaning — Saturday 10am");
  });

  test("a resident cannot edit or delete one", async () => {
    assert.equal((await patch(`/api/notices/${noticeId}`, { title: "Hacked" }, resident.accessToken)).status, 403);
    assert.equal((await del(`/api/notices/${noticeId}`, resident.accessToken)).status, 403);
  });

  test("deleting takes its comments and reactions with it", async () => {
    assert.equal((await del(`/api/notices/${noticeId}`, secretary.accessToken)).status, 204);
    const { body } = await get("/api/notices", resident.accessToken);
    assert.equal(body.notices.find((n) => n.id === noticeId), undefined);
    /* The board still stands; only that notice went. */
    assert.ok(body.notices.length >= 1);
  });

  test("an empty notice is refused", async () => {
    const { status } = await post("/api/notices", { title: "Hi", body: "" }, secretary.accessToken);
    assert.equal(status, 422);
  });
});

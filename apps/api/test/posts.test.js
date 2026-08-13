/**
 * The residents' board — discussions, recommendations and the marketplace.
 *
 * Two things are being pinned down here. One is that a listing reaches other
 * households at all, which it did not while the board lived in local storage.
 * The other is the seller's phone number: the screen offers to dial the person
 * who posted, and that number may only be shown under the same consent the
 * resident directory asks for.
 */
import "./setup.js";
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post, del, login, ACCOUNTS } from "./helpers.js";

const SHARER = "resident.d-102@greenvalley.in"; // the one seeded resident who opted in

describe("community posts", () => {
  let resident, other, secretary, guard, sharer;
  let listing;

  const board = async (token) => (await get("/api/posts", token)).body.posts;
  const find = async (token, id) => (await board(token)).find((p) => p.id === id);

  before(async () => {
    await startTestServer();
    resident = await login(ACCOUNTS.resident);
    other = await login(ACCOUNTS.otherResident);
    secretary = await login(ACCOUNTS.secretary);
    guard = await login(ACCOUNTS.guard);
    sharer = await login(SHARER);

    const created = await post("/api/posts", {
      type: "classified",
      title: "Godrej 3-door wardrobe",
      body: "Three years old, moving out this week.",
      price: 8000,
    }, resident.accessToken);
    assert.equal(created.status, 201);
    listing = created.body.post;
  });

  after(stopTestServer);

  test("a resident may post — this board is not the committee's", async () => {
    const { status } = await post("/api/posts", {
      type: "discussion", title: "Low water pressure in E block?", body: "Weak in the mornings.",
    }, resident.accessToken);
    assert.equal(status, 201);
  });

  test("it reaches other households", async () => {
    const seen = await find(other.accessToken, listing.id);
    assert.ok(seen, "the listing is on the neighbour's board");
    assert.equal(seen.price, 8000);
    assert.equal(seen.author, "Rahul Mehta");
    assert.equal(seen.authorFlat, "A-401");
  });

  test("free is a price, and the default one for a giveaway", async () => {
    const { body } = await post("/api/posts", { type: "classified", title: "Kids bicycle, 20 inch" }, resident.accessToken);
    assert.equal(body.post.price, 0, "not null — the screen shows 'Free' rather than nothing");
  });

  test("a price on a discussion is refused rather than quietly dropped", async () => {
    const { status } = await post("/api/posts", { type: "discussion", title: "Anyone up for badminton?", price: 500 }, resident.accessToken);
    assert.equal(status, 422);
  });

  describe("the seller's phone number", () => {
    test("is withheld from a neighbour who was never given it", async () => {
      const seen = await find(other.accessToken, listing.id);
      assert.equal(seen.contactHidden, true);
      assert.ok(!/^\d{10}$/.test(seen.authorPhone), `a dialable number reached the browser: ${seen.authorPhone}`);
    });

    test("is shown to the committee, who can already see the directory", async () => {
      const seen = await find(secretary.accessToken, listing.id);
      assert.equal(seen.contactHidden, false);
      assert.match(seen.authorPhone, /^\d{10}$/);
    });

    test("is shown when that resident opted in to sharing it", async () => {
      const theirs = await post("/api/posts", { type: "classified", title: "Dining table, seats six", price: 4500 }, sharer.accessToken);
      const seen = await find(other.accessToken, theirs.body.post.id);
      assert.equal(seen.contactHidden, false, "they chose to be reachable");
      assert.match(seen.authorPhone, /^\d{10}$/);
    });

    test("is always shown to the person whose number it is", async () => {
      const seen = await find(resident.accessToken, listing.id);
      assert.equal(seen.contactHidden, false);
      assert.equal(seen.mine, true);
    });
  });

  describe("likes", () => {
    test("count once however many times one person taps", async () => {
      await post(`/api/posts/${listing.id}/like`, {}, other.accessToken);
      await post(`/api/posts/${listing.id}/like`, {}, other.accessToken);
      await post(`/api/posts/${listing.id}/like`, {}, other.accessToken);
      const seen = await find(other.accessToken, listing.id);
      /* Odd number of taps, so the last one is a like rather than an unlike —
         the point is that it is one, not three. */
      assert.equal(seen.likes, 1);
      assert.equal(seen.liked, true);
    });

    test("are taken back by tapping again", async () => {
      await post(`/api/posts/${listing.id}/like`, {}, other.accessToken);
      const seen = await find(other.accessToken, listing.id);
      assert.equal(seen.likes, 0);
      assert.equal(seen.liked, false);
    });

    test("belong to a person, so two residents make two", async () => {
      await post(`/api/posts/${listing.id}/like`, {}, other.accessToken);
      await post(`/api/posts/${listing.id}/like`, {}, guard.accessToken);
      const seen = await find(other.accessToken, listing.id);
      assert.equal(seen.likes, 2);
    });
  });

  describe("replies", () => {
    test("are visible to everyone on the board", async () => {
      const { status } = await post(`/api/posts/${listing.id}/comments`, { text: "Is it still available?" }, other.accessToken);
      assert.equal(status, 201);
      const seen = await find(resident.accessToken, listing.id);
      assert.equal(seen.comments.length, 1);
      assert.equal(seen.comments[0].text, "Is it still available?");
      assert.ok(seen.comments[0].author, "and carry a name, not just an id");
    });

    test("an empty one is refused", async () => {
      const { status } = await post(`/api/posts/${listing.id}/comments`, { text: "   " }, other.accessToken);
      assert.equal(status, 422);
    });

    test("their author can delete their own", async () => {
      const seen = await find(other.accessToken, listing.id);
      const { status } = await del(`/api/posts/${listing.id}/comments/${seen.comments[0].id}`, other.accessToken);
      assert.equal(status, 200);
      assert.equal((await find(other.accessToken, listing.id)).comments.length, 0);
    });

    test("but not someone else's", async () => {
      await post(`/api/posts/${listing.id}/comments`, { text: "I'll take it." }, other.accessToken);
      const seen = await find(guard.accessToken, listing.id);
      const { status } = await del(`/api/posts/${listing.id}/comments/${seen.comments[0].id}`, guard.accessToken);
      assert.equal(status, 403);
    });

    test("and the committee can, which is what moderation means", async () => {
      const seen = await find(secretary.accessToken, listing.id);
      const { status } = await del(`/api/posts/${listing.id}/comments/${seen.comments[0].id}`, secretary.accessToken);
      assert.equal(status, 200);
    });
  });

  describe("taking a post down", () => {
    test("a neighbour cannot remove your listing", async () => {
      assert.equal((await del(`/api/posts/${listing.id}`, other.accessToken)).status, 403);
    });

    test("the committee can", async () => {
      const theirs = await post("/api/posts", { type: "discussion", title: "Something out of order" }, other.accessToken);
      assert.equal((await del(`/api/posts/${theirs.body.post.id}`, secretary.accessToken)).status, 204);
    });

    test("and so can you, for your own — a sold item should leave the board", async () => {
      assert.equal((await del(`/api/posts/${listing.id}`, resident.accessToken)).status, 204);
      assert.equal(await find(resident.accessToken, listing.id), undefined);
    });

    test("which takes its replies and likes with it", async () => {
      const seen = await find(other.accessToken, listing.id);
      assert.equal(seen, undefined);
    });
  });
});

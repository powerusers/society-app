/**
 * Daily help and the attendance the gate records.
 *
 * Two things this could not do while it lived in the browser. A household could
 * not see whether their maid had actually arrived, because the check-in the
 * guard tapped was written on the guard's device. And the rating a flat gave
 * was a single number on the record, so whichever household rated last replaced
 * every other household's opinion.
 */
import "./setup.js";
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post, patch, del, login, ACCOUNTS } from "./helpers.js";

describe("daily help", () => {
  let secretary, resident, other, guard;
  let maid;

  const register = async (token) => (await get("/api/help", token)).body;
  const attendance = async (token) => (await get("/api/help/attendance/recent", token)).body.attendance;
  const find = async (token, id) => (await register(token)).help.find((h) => h.id === id);

  before(async () => {
    await startTestServer();
    secretary = await login(ACCOUNTS.secretary);
    resident = await login(ACCOUNTS.resident);
    other = await login(ACCOUNTS.otherResident);
    guard = await login(ACCOUNTS.guard);

    const created = await post("/api/help",
      { name: "Lakshmi Bai", role: "Maid", phone: "9876500011", biometric: true }, resident.accessToken);
    assert.equal(created.status, 201);
    maid = created.body.help;
  });

  after(stopTestServer);

  describe("who sees whom", () => {
    test("a household sees the help who work for it", async () => {
      const { help, scope } = await register(resident.accessToken);
      assert.equal(scope, "flat");
      assert.ok(help.find((h) => h.id === maid.id));
      assert.ok(help.every((h) => h.flats.includes("A-401")), "and nobody else's");
    });

    test("a neighbour does not", async () => {
      assert.equal(await find(other.accessToken, maid.id), undefined);
    });

    test("a guard sees the whole register, because the desk needs it", async () => {
      const { help, scope } = await register(guard.accessToken);
      assert.equal(scope, "society");
      assert.ok(help.find((h) => h.id === maid.id));
    });

    test("and a neighbour cannot open one person's record either", async () => {
      const { status } = await get(`/api/help/${maid.id}`, other.accessToken);
      assert.equal(status, 403);
    });
  });

  describe("adding someone", () => {
    test("issues a card code the gate can scan", async () => {
      assert.match(maid.cardCode, /^[A-Z2-9]{6}$/);
      const { status, body } = await get(`/api/help/card/${maid.cardCode.toLowerCase()}`, guard.accessToken);
      assert.equal(status, 200, "however it is typed");
      assert.equal(body.help.id, maid.id);
    });

    test("but a resident cannot look up a card — it is the gate's credential", async () => {
      const { status } = await get(`/api/help/card/${maid.cardCode}`, resident.accessToken);
      assert.equal(status, 403);
    });

    test("a resident cannot mark their own help police-verified", async () => {
      const { body } = await post("/api/help",
        { name: "Ramesh Kumar", role: "Driver", policeVerified: true }, resident.accessToken);
      assert.equal(body.help.policeVerified, false, "otherwise the badge means nothing");
    });

    test("the committee can", async () => {
      const { status, body } = await patch(`/api/help/${maid.id}`, { policeVerified: true }, secretary.accessToken);
      assert.equal(status, 200);
      assert.equal(body.help.policeVerified, true);
    });

    test("and a resident still cannot, on a record they can otherwise edit", async () => {
      const { status } = await patch(`/api/help/${maid.id}`, { policeVerified: false }, resident.accessToken);
      assert.equal(status, 403);
    });

    test("a resident cannot add help against a neighbour's flat", async () => {
      const { status } = await post("/api/help", { name: "Nobody", flatCode: "B-201" }, resident.accessToken);
      assert.equal(status, 403);
    });
  });

  describe("one person, several households", () => {
    test("a neighbour can take on the same maid without a second record", async () => {
      const { status, body } = await post(`/api/help/${maid.id}/flats`, {}, other.accessToken);
      assert.equal(status, 200);
      assert.deepEqual(body.help.flats.sort(), ["A-401", "C-105"]);
      /* One card, one human being — the gate would otherwise have two people
         to check in and would credit whichever it scanned. */
      assert.equal(body.help.cardCode, maid.cardCode);
    });

    test("and cannot take her on twice", async () => {
      assert.equal((await post(`/api/help/${maid.id}/flats`, {}, other.accessToken)).status, 409);
    });

    test("letting go removes her from your flat, not from the society", async () => {
      assert.equal((await del(`/api/help/${maid.id}/flats`, other.accessToken)).status, 204);
      assert.equal(await find(other.accessToken, maid.id), undefined, "gone from the neighbour's list");
      const stillTheirs = await find(resident.accessToken, maid.id);
      assert.ok(stillTheirs, "and still working for the household that added her");
      assert.deepEqual(stillTheirs.flats, ["A-401"]);
    });

    test("the record goes only when the last flat lets go", async () => {
      const { body } = await post("/api/help", { name: "Temporary Cook", role: "Cook" }, other.accessToken);
      const id = body.help.id;
      assert.equal((await del(`/api/help/${id}/flats`, other.accessToken)).status, 204);
      assert.equal((await get(`/api/help/${id}`, guard.accessToken)).status, 404, "nobody employs them, so there is nothing to keep");
    });
  });

  describe("ratings", () => {
    test("only a household they work for may rate them", async () => {
      const { status } = await post(`/api/help/${maid.id}/rating`, { stars: 1 }, other.accessToken);
      assert.equal(status, 403);
    });

    test("a rating is an average of households, not the last opinion", async () => {
      await post(`/api/help/${maid.id}/rating`, { stars: 5 }, resident.accessToken);
      await post(`/api/help/${maid.id}/flats`, {}, other.accessToken);
      await post(`/api/help/${maid.id}/rating`, { stars: 3 }, other.accessToken);

      const seen = await find(resident.accessToken, maid.id);
      assert.equal(seen.rating, 4, "five and three, not whichever was typed last");
      assert.equal(seen.raters, 2);
      assert.equal(seen.myRating, 5, "and this household still sees its own");
    });

    test("changing your mind replaces your own rating and nobody else's", async () => {
      await post(`/api/help/${maid.id}/rating`, { stars: 1 }, resident.accessToken);
      const seen = await find(other.accessToken, maid.id);
      assert.equal(seen.rating, 2, "one and three");
      assert.equal(seen.raters, 2, "still two households");
    });
  });

  describe("attendance", () => {
    test("a resident cannot check anyone in — that is the gate's job", async () => {
      const { status } = await post(`/api/help/${maid.id}/attendance`, { direction: "in" }, resident.accessToken);
      assert.equal(status, 403);
    });

    test("the gate checks her in, and the household can see it", async () => {
      const { status, body } = await post(`/api/help/${maid.id}/attendance`,
        { direction: "in", mode: "biometric" }, guard.accessToken);
      assert.equal(status, 200);
      assert.equal(body.help.status, "in");
      assert.ok(body.help.lastIn);

      const seen = await find(resident.accessToken, maid.id);
      assert.equal(seen.status, "in", "on the resident's own device, which is the whole point");
    });

    test("she cannot be checked in twice", async () => {
      const { status, body } = await post(`/api/help/${maid.id}/attendance`, { direction: "in" }, guard.accessToken);
      assert.equal(status, 409);
      assert.match(body.error.message, /already inside/);
    });

    test("nor by two check-in desks at the same instant", async () => {
      /* The guard at the gate and the administrator at the office desk, both
         holding gate.operate and both tapping at once. Check-then-insert would
         open two visits; the partial unique index opens one. */
      const someone = (await register(guard.accessToken)).help.find((h) => h.status === "out");
      const results = await Promise.all([
        post(`/api/help/${someone.id}/attendance`, { direction: "in" }, guard.accessToken),
        post(`/api/help/${someone.id}/attendance`, { direction: "in" }, secretary.accessToken),
      ]);
      const codes = results.map((r) => r.status).sort();
      assert.deepEqual(codes, [200, 409], "one visit opened, not two");
    });

    test("checking out closes the visit and records the hours", async () => {
      const { body } = await post(`/api/help/${maid.id}/attendance`, { direction: "out" }, guard.accessToken);
      assert.equal(body.help.status, "out");
      const rows = await attendance(resident.accessToken);
      const today = rows.find((a) => a.helpId === maid.id);
      assert.ok(today.inAt && today.outAt, "a closed visit with both ends");
      assert.equal(today.mode, "biometric");
    });

    test("and checking out someone who is not inside says so", async () => {
      const { status } = await post(`/api/help/${maid.id}/attendance`, { direction: "out" }, guard.accessToken);
      assert.equal(status, 409);
    });

    test("the household's register holds only their own staff", async () => {
      const rows = await attendance(resident.accessToken);
      const ids = new Set((await register(resident.accessToken)).help.map((h) => h.id));
      assert.ok(rows.every((a) => ids.has(a.helpId)), "not the whole society's comings and goings");
      assert.ok(rows.length > 0);
    });

    test("while the gate's holds everyone's", async () => {
      const rows = await attendance(guard.accessToken);
      const mine = new Set((await register(resident.accessToken)).help.map((h) => h.id));
      assert.ok(rows.some((a) => !mine.has(a.helpId)));
    });
  });
});

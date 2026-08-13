/**
 * The incident register.
 *
 * Written on the guard's device until now, which made it evidence of nothing:
 * the committee it was recorded for could not see it. Two rules matter beyond
 * it simply crossing devices — residents cannot read a register that names
 * their neighbours, and the guard who writes an incident is not the person who
 * signs it off.
 */
import "./setup.js";
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post, login, ACCOUNTS } from "./helpers.js";

describe("incidents", () => {
  let secretary, treasurer, resident, guard, manager;
  let raised;

  const register = async (token) => (await get("/api/incidents", token)).body.incidents;
  const find = async (token, id) => (await register(token)).find((i) => i.id === id);

  before(async () => {
    await startTestServer();
    secretary = await login(ACCOUNTS.secretary);
    treasurer = await login(ACCOUNTS.treasurer);
    resident = await login(ACCOUNTS.resident);
    guard = await login(ACCOUNTS.guard);
    manager = await login(ACCOUNTS.manager);

    const created = await post("/api/incidents", {
      type: "misbehaviour", severity: "high",
      involves: "Visitor at Main Gate",
      note: "Refused to share ID and argued with the guard.",
    }, guard.accessToken);
    assert.equal(created.status, 201);
    raised = created.body.incident;
  });

  after(stopTestServer);

  describe("who may read it", () => {
    test("a resident cannot — the register names their neighbours", async () => {
      const { status } = await get("/api/incidents", resident.accessToken);
      assert.equal(status, 403);
    });

    test("the gate can", async () => {
      assert.ok(await find(guard.accessToken, raised.id));
    });

    test("and so can the committee it was recorded for", async () => {
      const seen = await find(treasurer.accessToken, raised.id);
      assert.equal(seen.involves, "Visitor at Main Gate");
      assert.equal(seen.byName, "Mohan Singh", "with the guard who wrote it");
      assert.ok(seen.gateName, "and the gate it happened at");
    });
  });

  describe("recording one", () => {
    test("a resident cannot", async () => {
      const { status } = await post("/api/incidents",
        { type: "safety", involves: "My neighbour's dog" }, resident.accessToken);
      assert.equal(status, 403);
    });

    test("a committee member who witnessed something can, without asking the guard to write it up", async () => {
      const { status, body } = await post("/api/incidents",
        { type: "safety", severity: "low", involves: "Lobby lift", note: "Door sensor slow to react." },
        treasurer.accessToken);
      assert.equal(status, 201);
      assert.equal(body.incident.byName, "Meena Patil");
    });

    test("it carries a recording reference for the committee to quote", async () => {
      assert.match(raised.recording, /^REC-\d{4}$/);
    });

    test("it opens open", async () => {
      assert.equal(raised.status, "open");
      assert.equal(raised.closedAt, null);
    });

    test("an incident about nobody in particular is refused", async () => {
      const { status } = await post("/api/incidents", { type: "other", involves: "  " }, guard.accessToken);
      assert.equal(status, 422);
    });

    test("a type the register does not have is refused", async () => {
      const { status } = await post("/api/incidents", { type: "gossip", involves: "Someone" }, guard.accessToken);
      assert.equal(status, 422);
    });
  });

  describe("closing one", () => {
    test("the guard who wrote it cannot sign it off", async () => {
      const { status } = await post(`/api/incidents/${raised.id}/close`, {}, guard.accessToken);
      assert.equal(status, 403, "otherwise the record protects nobody");
    });

    test("nor can another guard", async () => {
      const other = await login("ravi@greenvalley.in");
      assert.equal((await post(`/api/incidents/${raised.id}/close`, {}, other.accessToken)).status, 403);
    });

    test("the committee can, and what they concluded is kept", async () => {
      const { status, body } = await post(`/api/incidents/${raised.id}/close`,
        { note: "Spoke to the resident who invited them. No further action." }, secretary.accessToken);
      assert.equal(status, 200);
      assert.equal(body.incident.status, "closed");
      assert.equal(body.incident.closedByName, "Suresh Joshi");
      assert.match(body.incident.closingNote, /No further action/);
      assert.ok(body.incident.closedAt);
    });

    test("the facility manager can too — they answer for the gate day to day", async () => {
      const one = await post("/api/incidents", { type: "vehicle", involves: "Car blocking the ramp" }, guard.accessToken);
      assert.equal((await post(`/api/incidents/${one.body.incident.id}/close`, {}, manager.accessToken)).status, 200);
    });

    test("and it cannot be closed twice", async () => {
      assert.equal((await post(`/api/incidents/${raised.id}/close`, {}, secretary.accessToken)).status, 409);
    });
  });

  describe("reopening", () => {
    test("brings a prematurely closed one back rather than needing a duplicate", async () => {
      const { status, body } = await post(`/api/incidents/${raised.id}/reopen`, {}, secretary.accessToken);
      assert.equal(status, 200);
      assert.equal(body.incident.status, "open");
      assert.equal(body.incident.closedAt, null);
      assert.equal(body.incident.closingNote, "", "the earlier conclusion no longer stands");
    });

    test("a guard cannot", async () => {
      assert.equal((await post(`/api/incidents/${raised.id}/reopen`, {}, guard.accessToken)).status, 403);
    });

    test("and an open one cannot be reopened", async () => {
      assert.equal((await post(`/api/incidents/${raised.id}/reopen`, {}, secretary.accessToken)).status, 409);
    });
  });

  describe("another society", () => {
    test("cannot see this one's register", async () => {
      const seen = await register(secretary.accessToken);
      assert.ok(seen.length > 0);
      assert.ok(seen.every((i) => i.involves), "sanity: the register has content to leak");

      const { status } = await get(`/api/incidents`, resident.accessToken);
      assert.equal(status, 403, "and a resident of this one cannot read it either");
    });
  });
});

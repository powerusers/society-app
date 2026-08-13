/**
 * Society staff: the guards and facility staff a committee employs.
 *
 * The screen has always been able to "create a login". It created a row in the
 * browser with no password, so the person it was created for could not sign in
 * anywhere. These are the rules that make it a real account — and the ones that
 * stop it being a way to mint power inside the society.
 */
import "./setup.js";
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post, patch, login, ACCOUNTS } from "./helpers.js";

describe("society staff", () => {
  let secretary, treasurer, resident, guard;
  let gateId;

  const members = async (token) => (await get("/api/users", token)).body.members;
  const find = async (token, id) => (await members(token)).find((m) => m.id === id);

  before(async () => {
    await startTestServer();
    secretary = await login(ACCOUNTS.secretary); // admin
    treasurer = await login(ACCOUNTS.treasurer); // committee
    resident = await login(ACCOUNTS.resident);
    guard = await login(ACCOUNTS.guard);
    gateId = (await get("/api/visitors/gates", secretary.accessToken)).body.gates[0].id;
  });

  after(stopTestServer);

  describe("creating one", () => {
    let created;

    test("the committee can, and gets a password to read out exactly once", async () => {
      const res = await post("/api/users", {
        name: "Ramesh Kumar", role: "guard", phone: "9876500123", gateId, shift: "06:00 – 14:00",
      }, treasurer.accessToken);
      assert.equal(res.status, 201);
      assert.match(res.body.password, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      created = res.body.member;
      assert.equal(created.role, "guard");
      assert.equal(created.shift, "06:00 – 14:00");
      assert.ok(created.gateName, "posted at a gate the console can name");
    });

    test("and the account actually works — which the browser version never did", async () => {
      /* The whole point: a login the committee creates is a login somebody can
         use, on their own phone, at the gate. */
      const password = (await post("/api/users", { name: "Sita Devi", role: "staff", designation: "Housekeeping" },
        secretary.accessToken)).body.password;
      const her = (await members(secretary.accessToken)).find((m) => m.name === "Sita Devi");
      const session = await login(her.email, password);
      assert.ok(session.accessToken);
      assert.equal(session.user.role, "staff");
    });

    test("a login is minted when the person has no email", async () => {
      const { body } = await post("/api/users", { name: "Ramesh Kumar", role: "guard" }, secretary.accessToken);
      assert.match(body.member.email, /@greenvalleysociety\.local$/);
      assert.notEqual(body.member.email, created.email, "two people of the same name get two logins");
    });

    test("a resident cannot create staff", async () => {
      const { status } = await post("/api/users", { name: "My friend", role: "guard" }, resident.accessToken);
      assert.equal(status, 403);
    });

    test("nor can a guard", async () => {
      const { status } = await post("/api/users", { name: "My cousin", role: "guard" }, guard.accessToken);
      assert.equal(status, 403);
    });

    test("and nobody can mint a committee member or an administrator this way", async () => {
      for (const role of ["committee", "admin", "resident"]) {
        const { status } = await post("/api/users", { name: "Back door", role }, secretary.accessToken);
        assert.equal(status, 422, `${role} should not be creatable as a staff login`);
      }
    });

    test("an address already in use is refused rather than colliding", async () => {
      const { status } = await post("/api/users",
        { name: "Someone Else", role: "staff", email: ACCOUNTS.resident }, secretary.accessToken);
      assert.equal(status, 409);
    });

    test("a gate from another society is refused", async () => {
      const { status } = await post("/api/users",
        { name: "Wrong gate", role: "guard", gateId: "00000000-0000-0000-0000-000000000000" }, secretary.accessToken);
      assert.equal(status, 422);
    });
  });

  describe("changing the posting", () => {
    let ramesh;

    before(async () => {
      ramesh = (await members(secretary.accessToken)).find((m) => m.shift === "06:00 – 14:00" && m.name === "Ramesh Kumar");
    });

    test("the committee can move a guard to another shift", async () => {
      const { status, body } = await patch(`/api/users/${ramesh.id}`, { shift: "22:00 – 06:00" }, treasurer.accessToken);
      assert.equal(status, 200);
      assert.equal(body.member.shift, "22:00 – 06:00");
    });

    test("a guard cannot rewrite their own posting", async () => {
      const { status } = await patch(`/api/users/${ramesh.id}`, { shift: "09:00 – 17:00" }, guard.accessToken);
      assert.equal(status, 403);
    });
  });

  describe("when someone leaves", () => {
    let leaver;

    before(async () => {
      const { body } = await post("/api/users", { name: "Departing Guard", role: "guard" }, secretary.accessToken);
      leaver = { ...body.member, password: body.password };
    });

    test("suspending ends the account rather than deleting the person", async () => {
      const { status, body } = await post(`/api/users/${leaver.id}/suspend`, {}, treasurer.accessToken);
      assert.equal(status, 200);
      assert.equal(body.member.status, "suspended");
      assert.ok(await find(secretary.accessToken, leaver.id), "still on the list, with their history intact");
    });

    test("and they can no longer sign in, in words that send them to the right person", async () => {
      const { status, body } = await post("/api/auth/login", { email: leaver.email, password: leaver.password });
      assert.equal(status, 401);
      assert.match(body.error.message, /suspended/);
    });

    test("reinstating lets them back in", async () => {
      assert.equal((await post(`/api/users/${leaver.id}/reinstate`, {}, treasurer.accessToken)).status, 200);
      const session = await login(leaver.email, leaver.password);
      assert.ok(session.accessToken);
    });

    test("nobody suspends themselves", async () => {
      const me = (await members(secretary.accessToken)).find((m) => m.email === ACCOUNTS.secretary);
      assert.equal((await post(`/api/users/${me.id}/suspend`, {}, secretary.accessToken)).status, 403);
    });

    test("a committee member cannot suspend an administrator", async () => {
      const admin = (await members(treasurer.accessToken)).find((m) => m.role === "admin");
      const { status, body } = await post(`/api/users/${admin.id}/suspend`, {}, treasurer.accessToken);
      assert.equal(status, 403);
      assert.match(body.error.message, /administrator/i);
    });

    test("an administrator can be suspended once another one exists", async () => {
      /* Only an administrator may suspend one, and nobody suspends themselves,
         so this needs two of them — which is also why the society can never be
         left with none by this route. */
      const them = (await members(secretary.accessToken)).find((m) => m.email === ACCOUNTS.treasurer);
      await patch(`/api/users/${them.id}/role`, { role: "admin" }, secretary.accessToken);

      const promoted = await login(ACCOUNTS.treasurer);
      const first = (await members(promoted.accessToken)).find((m) => m.email === ACCOUNTS.secretary);
      const { status } = await post(`/api/users/${first.id}/suspend`, {}, promoted.accessToken);
      assert.equal(status, 200);

      /* And the survivor cannot suspend themselves, so one is always left. */
      const survivor = (await members(promoted.accessToken)).find((m) => m.email === ACCOUNTS.treasurer);
      assert.equal((await post(`/api/users/${survivor.id}/suspend`, {}, promoted.accessToken)).status, 403);

      await post(`/api/users/${first.id}/reinstate`, {}, promoted.accessToken);
    });
  });

  describe("a forgotten password", () => {
    test("the committee issues a new one, shown once", async () => {
      const { body } = await post("/api/users", { name: "Forgetful Guard", role: "guard" }, secretary.accessToken);
      const them = body.member;

      const reset = await post(`/api/users/${them.id}/password`, {}, treasurer.accessToken);
      assert.equal(reset.status, 200);
      assert.match(reset.body.password, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      assert.notEqual(reset.body.password, body.password, "a new one, not the old one read back");

      const session = await login(them.email, reset.body.password);
      assert.ok(session.accessToken);
    });

    test("the old password stops working", async () => {
      const { body } = await post("/api/users", { name: "Rotated Guard", role: "guard" }, secretary.accessToken);
      await post(`/api/users/${body.member.id}/password`, {}, secretary.accessToken);
      const { status } = await post("/api/auth/login", { email: body.member.email, password: body.password });
      assert.equal(status, 401);
    });

    test("and nobody resets their own this way", async () => {
      const me = (await members(treasurer.accessToken)).find((m) => m.email === ACCOUNTS.treasurer);
      assert.equal((await post(`/api/users/${me.id}/password`, {}, treasurer.accessToken)).status, 403);
    });
  });
});

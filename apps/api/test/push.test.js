/**
 * Who a gate request reaches.
 *
 * This is the privacy boundary of the push feature. A visitor at A-401 is A-401's
 * business: the notification names a person standing at the gate and the flat
 * they are asking for, and sending that to the wrong household is both a leak and
 * a way to get a stranger let in by someone with no reason to recognise them.
 *
 * The scoping is two steps and both are tested here — the flat lookup that picks
 * the people, and the token query that picks their devices.
 */
import "./setup.js";
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, call, post, patch, login, ACCOUNTS } from "./helpers.js";
import { query, one } from "../src/db/pool.js";
import { recipientTokens, usersInFlat } from "../src/lib/push.js";

describe("push recipients", () => {
  let guard, rahul, society, flatA401, flatC105;

  /** Registers a device the way the app does on launch. */
  const registerDevice = (token, authToken) =>
    post("/api/devices", { token, platform: "android" }, authToken);

  const userByEmail = (email) => one("SELECT id, flat_id, society_id FROM users WHERE email = $1", [email]);

  before(async () => {
    await startTestServer();
    guard = await login(ACCOUNTS.guard);
    rahul = await login(ACCOUNTS.resident);
    const other = await login(ACCOUNTS.otherResident);

    const rahulRow = await userByEmail(ACCOUNTS.resident);
    const otherRow = await userByEmail(ACCOUNTS.otherResident);
    society = rahulRow.society_id;
    flatA401 = rahulRow.flat_id;
    flatC105 = otherRow.flat_id;

    /* One device each, so a leak shows up as somebody else's token appearing
       rather than as an empty list that could pass for correctness. */
    await registerDevice("tok-rahul-a401", rahul.accessToken);
    await registerDevice("tok-other-c105", other.accessToken);
    await registerDevice("tok-guard", guard.accessToken);
  });

  after(stopTestServer);

  describe("choosing the household", () => {
    test("only members of that flat are selected", async () => {
      const ids = await usersInFlat(society, flatA401);
      const rahulRow = await userByEmail(ACCOUNTS.resident);
      const otherRow = await userByEmail(ACCOUNTS.otherResident);

      assert.ok(ids.includes(rahulRow.id), "the flat's own resident is included");
      assert.ok(!ids.includes(otherRow.id), "another flat's resident is not");
    });

    test("every member of the flat is selected, not just one", async () => {
      /* A household is several people and several phones. Whoever is nearest the
         door should be able to answer, so this must not stop at the first row. */
      const second = await one(
        `INSERT INTO users (society_id, name, email, phone, password_hash, role, flat_id, relation)
         VALUES ($1, 'Anita Mehta', 'anita.test@greenvalley.in', '9800000001', 'x', 'resident', $2, 'co-owner')
         RETURNING id`,
        [society, flatA401],
      );

      const ids = await usersInFlat(society, flatA401);
      assert.ok(ids.includes(second.id), "a second member of the same flat is included");
      assert.ok(ids.length >= 2, "the whole household, not the first match");

      await query("DELETE FROM users WHERE id = $1", [second.id]);
    });

    test("a suspended member is left out", async () => {
      const rahulRow = await userByEmail(ACCOUNTS.resident);
      await query("UPDATE users SET status = 'suspended' WHERE id = $1", [rahulRow.id]);

      const ids = await usersInFlat(society, flatA401);
      assert.ok(!ids.includes(rahulRow.id), "suspended members stop being told");

      await query("UPDATE users SET status = 'active' WHERE id = $1", [rahulRow.id]);
    });

    test("a flat with nobody in it selects nobody", async () => {
      const empty = await one(
        "SELECT id FROM flats WHERE society_id = $1 AND id NOT IN (SELECT flat_id FROM users WHERE flat_id IS NOT NULL) LIMIT 1",
        [society],
      );
      if (!empty) return; // the seed happens to have filled every flat
      assert.deepEqual(await usersInFlat(society, empty.id), []);
    });
  });

  describe("choosing the devices", () => {
    test("only the selected users' devices are returned", async () => {
      const ids = await usersInFlat(society, flatA401);
      const tokens = await recipientTokens(ids, "gate");

      assert.ok(tokens.includes("tok-rahul-a401"), "the flat's resident's phone");
      assert.ok(!tokens.includes("tok-other-c105"), "not another flat's phone");
      assert.ok(!tokens.includes("tok-guard"), "not the guard's phone");
    });

    test("nobody selected means nothing sent", async () => {
      assert.deepEqual(await recipientTokens([], "gate"), []);
    });

    test("a resident who muted gate alerts is skipped", async () => {
      const rahulRow = await userByEmail(ACCOUNTS.resident);
      await query(`UPDATE users SET notify = '{"gate": false}'::jsonb WHERE id = $1`, [rahulRow.id]);

      assert.ok(!(await recipientTokens([rahulRow.id], "gate")).includes("tok-rahul-a401"));
      /* Muting the gate does not mute everything else. */
      assert.ok((await recipientTokens([rahulRow.id], "society")).includes("tok-rahul-a401"));

      await query(`UPDATE users SET notify = '{}'::jsonb WHERE id = $1`, [rahulRow.id]);
    });

    test("a resident who has never touched the setting still gets told", async () => {
      const rahulRow = await userByEmail(ACCOUNTS.resident);
      const tokens = await recipientTokens([rahulRow.id], "gate");
      assert.ok(tokens.includes("tok-rahul-a401"), "absent preference means on");
    });
  });

  describe("a phone that changes hands", () => {
    test("registering the same token re-points it at whoever signed in", async () => {
      /* The same physical device, now used by a resident of another flat. If the
         old row survived, C-105's phone would go on ringing for A-401's
         visitors — which is the leak this unique constraint exists to stop. */
      const other = await login(ACCOUNTS.otherResident);
      await registerDevice("tok-rahul-a401", other.accessToken);

      const ids = await usersInFlat(society, flatA401);
      const tokens = await recipientTokens(ids, "gate");
      assert.ok(
        !tokens.includes("tok-rahul-a401"),
        "the handed-over phone no longer receives the old flat's requests",
      );

      const rows = await query("SELECT count(*)::int AS n FROM device_tokens WHERE token = $1", ["tok-rahul-a401"]);
      assert.equal(rows.rows[0].n, 1, "re-pointed, not duplicated");

      // Put it back for any test that runs after this one.
      await registerDevice("tok-rahul-a401", rahul.accessToken);
    });

    test("signing out drops the device", async () => {
      await post("/api/devices", { token: "tok-temp", platform: "android" }, rahul.accessToken);
      assert.equal((await query("SELECT 1 FROM device_tokens WHERE token = 'tok-temp'")).rowCount, 1);

      /* DELETE carries the token in the body, so this goes through call() —
         helpers' del() sends no body. */
      const res = await call("DELETE", "/api/devices", {
        token: rahul.accessToken,
        body: { token: "tok-temp" },
      });
      assert.equal(res.status, 204);

      const after = await query("SELECT 1 FROM device_tokens WHERE token = 'tok-temp'");
      assert.equal(after.rowCount, 0, "the token is gone, not just orphaned");
    });

    test("one resident cannot drop another's device", async () => {
      /* A device token is a delivery address. If anyone could delete an arbitrary
         one, they could silence a neighbour's gate alerts. */
      const other = await login(ACCOUNTS.otherResident);
      const res = await call("DELETE", "/api/devices", {
        token: other.accessToken,
        body: { token: "tok-rahul-a401" },
      });
      assert.equal(res.status, 204, "the request succeeds…");

      const still = await query("SELECT 1 FROM device_tokens WHERE token = 'tok-rahul-a401'");
      assert.equal(still.rowCount, 1, "…but somebody else's device is untouched");
    });
  });

  describe("the gate lifecycle actually reaches this", () => {
    test("sending a visitor to a flat picks that flat's devices", async () => {
      const { body: created } = await post(
        "/api/visitors",
        { name: "Zomato Delivery", category: "delivery", flatCode: "A-401", status: "waiting" },
        guard.accessToken,
      );
      assert.ok(created.visitor, "guard recorded the arrival");

      const { status } = await patch(
        `/api/visitors/${created.visitor.id}/status`,
        { status: "pending" },
        guard.accessToken,
      );
      assert.equal(status, 200, "guard sent it up to the flat");

      /* The route's own recipient selection, repeated here against the same
         inputs: everyone in the visitor's flat except whoever pressed the button.
         The guard has no flat, so they were never a candidate. */
      const visitor = await one("SELECT flat_id, society_id FROM visitors WHERE id = $1", [created.visitor.id]);
      const tokens = await recipientTokens(await usersInFlat(visitor.society_id, visitor.flat_id), "gate");

      assert.ok(tokens.includes("tok-rahul-a401"));
      assert.ok(!tokens.includes("tok-other-c105"));
      assert.ok(!tokens.includes("tok-guard"));
    });
  });
});

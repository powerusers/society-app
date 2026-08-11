/**
 * Society invite codes.
 *
 * A code is a bearer credential that creates a society and its administrator,
 * so what matters is that it is spendable exactly once, only before it expires,
 * only for what it was pinned to, and never after it is revoked. The last test
 * races two redemptions of one code, because "single use" is a claim about
 * concurrency, not about the happy path.
 */
import "./setup.js";
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, call, get } from "./helpers.js";
import { query } from "../src/db/pool.js";

const TOKEN = process.env.SETUP_TOKEN;
const op = (method, path, body) => call(method, path, { body, headers: { "x-setup-token": TOKEN } });
const withCode = (code, body) => call("POST", "/api/setup", { body, headers: { "x-setup-token": code } });

const society = (name, email) => ({
  society: { name, address: "Somewhere, Pune", regNo: "", gstin: "" },
  admin: { name: `${name} Admin`, email, phone: "9800000000", password: "a-properly-long-passphrase" },
});

const issue = async (opts = {}) => (await op("POST", "/api/setup/invites", opts)).body.invite;

describe("society invite codes", () => {
  before(async () => { await startTestServer({ seed: false }); });
  after(stopTestServer);

  test("issuing requires the operator token, not an invite", async () => {
    const anon = await call("POST", "/api/setup/invites", { body: {} });
    assert.equal(anon.status, 403);

    const invite = await issue({ label: "probe" });
    const asInvite = await call("POST", "/api/setup/invites", {
      body: {}, headers: { "x-setup-token": invite.code },
    });
    assert.equal(asInvite.status, 403, "a code cannot mint more codes");
  });

  test("the code is returned once and never stored in the clear", async () => {
    const invite = await issue({ label: "one-time" });
    assert.match(invite.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    const { rows } = await query("SELECT code_hash FROM society_invites WHERE id = $1", [invite.id]);
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].code_hash, invite.code);
    assert.doesNotMatch(rows[0].code_hash, /-/, "the stored value is a hash, not the code");

    const listed = await op("GET", "/api/setup/invites");
    const found = listed.body.invites.find((i) => i.id === invite.id);
    assert.ok(found, "it is listed");
    assert.equal(found.code, undefined, "listing never carries the code back");
  });

  test("a code creates a society, and cannot be spent twice", async () => {
    const invite = await issue({ label: "Alpha" });
    const first = await withCode(invite.code, society("Alpha Heights", "a@alpha.in"));
    assert.equal(first.status, 201);

    const second = await withCode(invite.code, society("Alpha Two", "b@alpha.in"));
    assert.equal(second.status, 403);
    assert.match(second.body.error.message, /already been used/i);
  });

  test("the code is accepted however it is typed", async () => {
    const invite = await issue({ label: "typing" });
    const messy = ` ${invite.code.replace(/-/g, "").toLowerCase()} `;
    const r = await withCode(messy, society("Lowercase Gardens", "a@lower.in"));
    assert.equal(r.status, 201, "lower case, no dashes, padded — same code");
  });

  test("a wrong code is refused and creates nothing", async () => {
    const before = await get("/api/setup/societies");
    const r = await withCode("ZZZZ-ZZZZ-ZZZZ", society("Ghost Society", "a@ghost.in"));
    assert.equal(r.status, 403);
    const after = await get("/api/setup/societies");
    assert.equal(after.body.societies.length, before.body.societies.length);
  });

  test("a revoked code stops working", async () => {
    const invite = await issue({ label: "revoke me" });
    const del = await op("DELETE", `/api/setup/invites/${invite.id}`);
    assert.equal(del.status, 204);

    const r = await withCode(invite.code, society("Revoked Court", "a@revoked.in"));
    assert.equal(r.status, 403);
    assert.match(r.body.error.message, /revoked/i);
  });

  test("an expired code stops working", async () => {
    const invite = await issue({ label: "expiring", days: 1 });
    await query("UPDATE society_invites SET expires_at = now() - interval '1 hour' WHERE id = $1", [invite.id]);

    const r = await withCode(invite.code, society("Expired Villas", "a@expired.in"));
    assert.equal(r.status, 403);
    assert.match(r.body.error.message, /expired/i);
  });

  test("a code pinned to a society creates only that society", async () => {
    const invite = await issue({ label: "pinned", societyName: "Sunrise Residency" });

    const wrong = await withCode(invite.code, society("Moonrise Residency", "a@moonrise.in"));
    assert.equal(wrong.status, 403);
    assert.match(wrong.body.error.message, /issued for "Sunrise Residency"/);

    const right = await withCode(invite.code, society("sunrise residency", "a@sunrise.in"));
    assert.equal(right.status, 201, "the pin is not case-sensitive");
  });

  test("a code pinned to an email is usable only by that person", async () => {
    const invite = await issue({ label: "pinned email", email: "secretary@beta.in" });

    const wrong = await withCode(invite.code, society("Beta Gardens", "someone@else.in"));
    assert.equal(wrong.status, 403);
    assert.match(wrong.body.error.message, /different email/i);

    const right = await withCode(invite.code, society("Beta Gardens", "secretary@beta.in"));
    assert.equal(right.status, 201);
  });

  test("a failed setup does not burn the code", async () => {
    const invite = await issue({ label: "rollback" });

    /* Fails on the duplicate-name check, after the code has been claimed
       inside the transaction. */
    const clash = await withCode(invite.code, society("Beta Gardens", "fresh@rollback.in"));
    assert.equal(clash.status, 409);

    const retry = await withCode(invite.code, society("Rollback Heights", "fresh@rollback.in"));
    assert.equal(retry.status, 201, "the code survived the failed attempt");
  });

  test("two requests racing one code produce exactly one society", async () => {
    const invite = await issue({ label: "race" });
    const [a, b] = await Promise.all([
      withCode(invite.code, society("Race One", "a@race.in")),
      withCode(invite.code, society("Race Two", "b@race.in")),
    ]);

    const statuses = [a.status, b.status].sort();
    assert.deepEqual(statuses, [201, 403], "one wins, one is told the code is spent");

    const listed = await get("/api/setup/societies");
    const names = listed.body.societies.map((s) => s.name);
    assert.equal(names.filter((n) => n.startsWith("Race ")).length, 1);
  });

  test("the operator token still works as an override", async () => {
    const r = await op("POST", "/api/setup", society("Operator Court", "a@operator.in"));
    assert.equal(r.status, 201);
  });

  test("a used code records which society it created", async () => {
    const listed = await op("GET", "/api/setup/invites");
    const used = listed.body.invites.find((i) => i.label === "Alpha");
    assert.equal(used.status, "used");
    assert.equal(used.used_by_name, "Alpha Heights");
  });
});

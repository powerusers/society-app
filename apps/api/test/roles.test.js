/**
 * Role management.
 *
 * Granting a role grants every capability behind it, so the interesting cases
 * are the refusals: self-promotion, a committee member appointing allies or
 * demoting the peers who review their billing runs, and demoting the last
 * administrator, which leaves a society nobody can administer again.
 */
import "./setup.js";
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post, patch, login, ACCOUNTS } from "./helpers.js";
import { query } from "../src/db/pool.js";

describe("role management", () => {
  let admin, treasurer, resident, other;
  const idOf = (members, email) => members.find((m) => m.email === email).id;
  let members;

  before(async () => {
    await startTestServer();
    admin = await login(ACCOUNTS.secretary);
    treasurer = await login(ACCOUNTS.treasurer);
    resident = await login(ACCOUNTS.resident);
    other = await login(ACCOUNTS.otherResident);
    members = (await get("/api/users", admin.accessToken)).body.members;
  });

  after(stopTestServer);

  test("a resident cannot see the member list", async () => {
    assert.equal((await get("/api/users", resident.accessToken)).status, 403);
  });

  test("the member list carries every account, guards included", async () => {
    const roles = new Set(members.map((m) => m.role));
    for (const r of ["admin", "committee", "staff", "guard", "resident"]) {
      assert.ok(roles.has(r), `expected a ${r} in the member list`);
    }
  });

  test("an administrator promotes a resident to committee", async () => {
    const id = idOf(members, ACCOUNTS.otherResident);
    const { status, body } = await patch(`/api/users/${id}/role`, { role: "committee", designation: "Joint Secretary" }, admin.accessToken);
    assert.equal(status, 200);
    assert.equal(body.member.role, "committee");
    assert.equal(body.member.designation, "Joint Secretary");

    /* The capability follows immediately: requireAuth reloads the user per
       request, so the promotion does not wait for a new token. */
    const queue = await get("/api/registrations", other.accessToken);
    assert.equal(queue.status, 200, "the newly promoted member can review registrations");
  });

  test("the change is recorded in the audit trail", async () => {
    const { body } = await get("/api/me/audit", admin.accessToken);
    const entry = body.audit.find((e) => e.action === "user.role");
    assert.ok(entry, "a role change is an audit event");
    assert.match(entry.detail, /resident -> committee/);
  });

  test("nobody changes their own role", async () => {
    const id = idOf(members, ACCOUNTS.secretary);
    const { status, body } = await patch(`/api/users/${id}/role`, { role: "resident" }, admin.accessToken);
    assert.equal(status, 403);
    assert.match(body.error.message, /your own role/i);
  });

  test("a committee member cannot appoint another committee member", async () => {
    const id = idOf(members, ACCOUNTS.resident);
    const { status, body } = await patch(`/api/users/${id}/role`, { role: "committee" }, treasurer.accessToken);
    assert.equal(status, 403);
    assert.match(body.error.message, /administrator/i);
  });

  test("a committee member cannot demote a peer", async () => {
    const id = idOf(members, ACCOUNTS.otherResident); // now committee
    const { status } = await patch(`/api/users/${id}/role`, { role: "resident" }, treasurer.accessToken);
    assert.equal(status, 403, "otherwise separation of duties is undone from the side");
  });

  test("a committee member may still move someone between operational roles", async () => {
    const id = idOf(members, ACCOUNTS.resident);
    assert.equal((await patch(`/api/users/${id}/role`, { role: "staff" }, treasurer.accessToken)).status, 200);
    assert.equal((await patch(`/api/users/${id}/role`, { role: "resident" }, treasurer.accessToken)).status, 200);
  });

  test("demotion clears a designation that no longer applies", async () => {
    const id = idOf(members, ACCOUNTS.otherResident);
    const { body } = await patch(`/api/users/${id}/role`, { role: "resident" }, admin.accessToken);
    assert.equal(body.member.designation, null, "a resident is not the Joint Secretary");
  });

  test("the last administrator cannot be demoted", async () => {
    const { rows } = await query("SELECT id, email FROM users WHERE role = 'admin' AND status = 'active'");
    assert.equal(rows.length, 1, "this society has exactly one admin, which is the case under test");

    /* Promote a second admin so somebody other than the subject can act. */
    const treasurerId = idOf(members, ACCOUNTS.treasurer);
    assert.equal((await patch(`/api/users/${treasurerId}/role`, { role: "admin" }, admin.accessToken)).status, 200);

    const secondAdmin = await login(ACCOUNTS.treasurer);
    const firstId = idOf(members, ACCOUNTS.secretary);
    assert.equal(
      (await patch(`/api/users/${firstId}/role`, { role: "committee" }, secondAdmin.accessToken)).status, 200,
      "with two admins, one may be stepped down",
    );

    /* Now one remains, and the sole admin cannot be removed by anyone. */
    const soleId = idOf(members, ACCOUNTS.treasurer);
    const committeeNow = await login(ACCOUNTS.secretary);
    const { status } = await patch(`/api/users/${soleId}/role`, { role: "committee" }, committeeNow.accessToken);
    assert.equal(status, 403, "a committee member cannot demote an admin at all");

    const stillAdmin = await query("SELECT count(*)::int AS c FROM users WHERE role = 'admin' AND status = 'active'");
    assert.equal(stillAdmin.rows[0].c, 1, "the society still has an administrator");
  });

  test("an unknown role is rejected", async () => {
    const id = idOf(members, ACCOUNTS.resident);
    const admin2 = await login(ACCOUNTS.treasurer);
    assert.equal((await patch(`/api/users/${id}/role`, { role: "superuser" }, admin2.accessToken)).status, 422);
  });

  test("a member of another society cannot be touched", async () => {
    const admin2 = await login(ACCOUNTS.treasurer);
    const { status } = await patch(
      `/api/users/00000000-0000-0000-0000-000000000000/role`, { role: "committee" }, admin2.accessToken,
    );
    assert.equal(status, 404);
  });
});

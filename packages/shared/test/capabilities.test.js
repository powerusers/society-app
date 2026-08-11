import test from "node:test";
import assert from "node:assert/strict";
import { can, canApproveRun, canActOnFlat, isFlatMember, CAPS, ROLES } from "../src/capabilities.js";

test("admin holds every capability via the wildcard", () => {
  assert.equal(can("admin", "billing.approve"), true);
  assert.equal(can("admin", "anything.at.all"), true);
});

test("a resident holds no management capability", () => {
  assert.equal(can("resident", "billing.approve"), false);
  assert.equal(can("resident", "gate.view"), false);
  assert.equal(can("resident", "notice.write"), false);
});

test("an unauthenticated caller holds nothing", () => {
  assert.equal(can(null, "gate.view"), false);
  assert.equal(can(undefined, "billing.approve"), false);
});

test("a guard can operate the gate but cannot touch money", () => {
  assert.equal(can("guard", "gate.operate"), true);
  assert.equal(can("guard", "billing.make"), false);
  assert.equal(can("guard", "accounts.view"), false);
});

test("staff prepare bills but cannot approve them", () => {
  assert.equal(can("staff", "billing.make"), true);
  assert.equal(can("staff", "billing.approve"), false);
});

test("every role in ROLES has an entry in CAPS", () => {
  for (const role of ROLES) assert.ok(CAPS[role], `${role} is missing from CAPS`);
});

test("the maker of a run cannot approve it, however senior", () => {
  const treasurer = { id: "u1", role: "committee" };
  const run = { makerId: "u1" };
  assert.deepEqual(canApproveRun(treasurer, run), { ok: false, reason: "maker_is_checker" });

  const admin = { id: "u1", role: "admin" };
  assert.equal(canApproveRun(admin, run).ok, false, "admin is not exempt from separation of duties");
});

test("a second officer with approval rights can approve", () => {
  assert.deepEqual(canApproveRun({ id: "u2", role: "committee" }, { makerId: "u1" }), { ok: true });
});

test("someone without the capability is refused before the maker check runs", () => {
  assert.deepEqual(
    canApproveRun({ id: "u9", role: "resident" }, { makerId: "u1" }),
    { ok: false, reason: "no_approve_capability" },
  );
});

test("a resident acts only on their own flat", () => {
  const rahul = { id: "u1", role: "resident", flat: "A-401" };
  assert.equal(canActOnFlat(rahul, "A-401"), true);
  assert.equal(canActOnFlat(rahul, "B-201"), false);
});

test("a resident with no flat on record acts on nothing", () => {
  assert.equal(canActOnFlat({ id: "u1", role: "resident" }, "A-401"), false);
});

test("a guard acts on any flat", () => {
  assert.equal(canActOnFlat({ id: "g1", role: "guard" }, "E-605"), true);
});

test("flat membership has no capability escape hatch", () => {
  // the decision to let a visitor in belongs to the household, not to the gate
  assert.equal(isFlatMember({ id: "g1", role: "guard" }, "A-401"), false);
  assert.equal(isFlatMember({ id: "a1", role: "admin" }, "A-401"), false);
  assert.equal(isFlatMember({ id: "u1", role: "resident", flat: "A-401" }, "A-401"), true);
});

test("flat membership is false when either side is missing", () => {
  assert.equal(isFlatMember({ id: "u1", role: "resident" }, "A-401"), false);
  assert.equal(isFlatMember({ id: "u1", role: "resident", flat: "A-401" }, null), false);
});

test("staff can see accounts but still cannot approve a run", () => {
  assert.equal(can("staff", "accounts.view"), true);
  assert.equal(can("staff", "billing.approve"), false);
});

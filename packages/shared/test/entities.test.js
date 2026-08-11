import test from "node:test";
import assert from "node:assert/strict";
import { canTransitionVisitor, canTransitionBill, VISITOR_STATUSES, VISITOR_TRANSITIONS } from "../src/entities.js";
import { createVisitorSchema, createTicketSchema, registrationSchema, fieldErrors } from "../src/validation.js";

test("the gate lifecycle only moves forward", () => {
  assert.equal(canTransitionVisitor("waiting", "pending"), true);
  assert.equal(canTransitionVisitor("pending", "approved"), true);
  assert.equal(canTransitionVisitor("approved", "inside"), true);
  assert.equal(canTransitionVisitor("inside", "exited"), true);
});

test("a denied visitor cannot be quietly admitted", () => {
  assert.equal(canTransitionVisitor("denied", "inside"), false);
  assert.equal(canTransitionVisitor("denied", "approved"), false);
});

test("a visitor cannot be admitted before the flat approves", () => {
  assert.equal(canTransitionVisitor("waiting", "inside"), false);
  assert.equal(canTransitionVisitor("pending", "inside"), false);
});

test("a pre-approved pass skips straight to entry", () => {
  assert.equal(canTransitionVisitor("pre-approved", "inside"), true);
});

test("terminal states go nowhere", () => {
  assert.deepEqual(VISITOR_TRANSITIONS.exited, []);
  assert.equal(canTransitionVisitor("exited", "inside"), false);
});

test("every visitor status has a transition entry", () => {
  for (const s of VISITOR_STATUSES) assert.ok(VISITOR_TRANSITIONS[s], `${s} has no transitions defined`);
});

test("bills cannot be paid before they are issued", () => {
  assert.equal(canTransitionBill("pending-approval", "paid"), false);
  assert.equal(canTransitionBill("pending-approval", "issued"), true);
  assert.equal(canTransitionBill("issued", "paid"), true);
});

test("a paid bill is final", () => {
  assert.equal(canTransitionBill("paid", "overdue"), false);
  assert.equal(canTransitionBill("paid", "issued"), false);
});

test("visitor payload rejects a malformed flat code", () => {
  const bad = createVisitorSchema.safeParse({ name: "Ramesh", category: "guest", flatCode: "A401" });
  assert.equal(bad.success, false);
  assert.match(fieldErrors(bad.error).flatCode, /A-401/);
});

test("visitor payload rejects a status the client should not set", () => {
  const bad = createVisitorSchema.safeParse({ name: "X", category: "guest", flatCode: "A-401", status: "inside" });
  assert.equal(bad.success, false, "clients must not create a visitor already inside");
});

test("visitor payload fills sensible defaults", () => {
  const ok = createVisitorSchema.parse({ name: "Ramesh", category: "guest", flatCode: "A-401" });
  assert.equal(ok.status, "waiting");
  assert.equal(ok.recurring, "once");
  assert.equal(ok.purpose, "");
});

test("ticket payload rejects an unknown category", () => {
  const bad = createTicketSchema.safeParse({ title: "Leak in bathroom", category: "Astrology" });
  assert.equal(bad.success, false);
});

test("ticket priority defaults to medium", () => {
  assert.equal(createTicketSchema.parse({ title: "Corridor light out", category: "Electrical" }).priority, "medium");
});

test("registration rejects a short password and a bad phone", () => {
  const bad = registrationSchema.safeParse({
    name: "Priya Sharma", flatCode: "B-302", relation: "owner",
    phone: "98765", email: "priya@example.com", password: "short",
  });
  assert.equal(bad.success, false);
  const errs = fieldErrors(bad.error);
  assert.match(errs.phone, /10-digit/);
  assert.match(errs.password, /8 characters/);
});

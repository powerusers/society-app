import test from "node:test";
import assert from "node:assert/strict";
import {
  computeBill, headAmount, lateFeeFor, isOverdue, narrationFor, receiptNoFor,
  settlementDueAt, slaDueAt, shiftCycle, currentCycle, DEFAULT_HEADS,
} from "../src/billing.js";

const owner = { area: 1000, occupancy: "owner-occupied", type: "2BHK" };
const tenanted = { area: 1000, occupancy: "tenant", type: "2BHK" };

test("per-sqft heads scale with carpet area", () => {
  assert.equal(headAmount({ basis: "per_sqft", rate: 3.2 }, owner), 3200);
  assert.equal(headAmount({ basis: "per_sqft", rate: 3.2 }, { ...owner, area: 1250 }), 4000);
});

test("per-slot heads scale with allotted parking", () => {
  const head = { basis: "per_slot", rate: 200 };
  assert.equal(headAmount(head, owner, 0), 0);
  assert.equal(headAmount(head, owner, 2), 400);
});

test("non-occupancy charges apply to tenanted flats only", () => {
  const head = { basis: "tenant_only", rate: 400 };
  assert.equal(headAmount(head, owner), 0);
  assert.equal(headAmount(head, tenanted), 400);
});

test("an unknown basis contributes nothing rather than NaN", () => {
  assert.equal(headAmount({ basis: "per_resident", rate: 100 }, owner), 0);
});

test("heads that evaluate to zero are left off the bill entirely", () => {
  const bill = computeBill(owner, DEFAULT_HEADS, 0);
  assert.ok(!bill.items.some((i) => i.headId === "h_ngc"), "owner-occupied flat should not be charged NGC");
  assert.ok(!bill.items.some((i) => i.headId === "h_park"), "no slots means no parking line");
});

test("GST is charged per head, not on the whole bill", () => {
  const bill = computeBill(owner, DEFAULT_HEADS, 1);
  const club = bill.items.find((i) => i.headId === "h_club");
  assert.equal(club.gst, 45, "18% of the 250 clubhouse charge");
  assert.equal(bill.gst, 45, "no other head is taxable");
  assert.equal(bill.total, bill.subtotal + bill.gst);
});

test("a tenanted 3BHK with two slots totals its parts", () => {
  const flat = { area: 1200, occupancy: "tenant" };
  const bill = computeBill(flat, DEFAULT_HEADS, 2);
  const expected = 3840 + 320 + 450 + 300 + 400 + 250 + 400; // maint, water, sinking, repair, parking, club, NGC
  assert.equal(bill.subtotal, expected);
  assert.equal(bill.total, expected + 45);
});

test("an empty head list produces an empty, zero bill", () => {
  assert.deepEqual(computeBill(owner, [], 1), { items: [], subtotal: 0, gst: 0, total: 0 });
});

test("late fee is a percentage of the total", () => {
  assert.equal(lateFeeFor(5000, 2), 100);
  assert.equal(lateFeeFor(5000, 0), 0);
  assert.equal(lateFeeFor(4999, 2), 100, "rounds to the rupee");
});

test("a paid bill is never overdue, whatever its due date", () => {
  assert.equal(isOverdue({ status: "paid", dueDate: "2020-01-10" }, 0), false);
});

test("the grace period pushes the overdue boundary out", () => {
  const bill = { status: "issued", dueDate: "2026-08-10" };
  const justAfter = new Date("2026-08-11T00:00:00Z");
  assert.equal(isOverdue(bill, 0, justAfter), true);
  assert.equal(isOverdue(bill, 5, justAfter), false, "still inside a 5-day grace period");
});

test("narration carries the flat number so credits reconcile", () => {
  assert.equal(
    narrationFor({ mode: "upi", flatCode: "A-401", cycle: "2026-08" }),
    "UPI/CR/GVS/A-401/202608",
  );
});

test("receipt numbers are stable for a flat and cycle", () => {
  assert.equal(receiptNoFor({ cycle: "2026-08", flatCode: "A-401" }), "RCT-202608-A-401");
});

test("settlement is due the configured number of minutes after payment", () => {
  const paid = new Date("2026-08-11T10:00:00Z");
  assert.equal(settlementDueAt(paid, 30).toISOString(), "2026-08-11T10:30:00.000Z");
});

test("SLA due time follows the priority table", () => {
  const from = new Date("2026-08-11T10:00:00Z");
  const hours = { high: 4, medium: 24, low: 72 };
  assert.equal(slaDueAt("high", hours, from).toISOString(), "2026-08-11T14:00:00.000Z");
  assert.equal(slaDueAt("low", hours, from).toISOString(), "2026-08-14T10:00:00.000Z");
});

test("an unknown priority falls back to 24 hours rather than NaN", () => {
  const from = new Date("2026-08-11T10:00:00Z");
  assert.equal(slaDueAt("urgent", { high: 4 }, from).toISOString(), "2026-08-12T10:00:00.000Z");
});

test("cycles shift across year boundaries", () => {
  assert.equal(shiftCycle("2026-08", 1), "2026-09");
  assert.equal(shiftCycle("2026-12", 1), "2027-01");
  assert.equal(shiftCycle("2026-01", -1), "2025-12");
  assert.equal(shiftCycle("2026-08", -12), "2025-08");
});

test("currentCycle formats as YYYY-MM", () => {
  assert.match(currentCycle(new Date("2026-03-04T00:00:00")), /^\d{4}-\d{2}$/);
  assert.equal(currentCycle(new Date("2026-03-04T00:00:00")), "2026-03");
});

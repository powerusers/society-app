import "./setup.js";
import test, { before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { query } from "../src/db/pool.js";
import { startTestServer, stopTestServer, get, post, patch, del, login, ACCOUNTS } from "./helpers.js";
import { currentCycle, shiftCycle } from "@gvs/shared";

let resident, treasurer, secretary, guard, manager, otherResident;

before(async () => {
  await startTestServer();
  [resident, treasurer, secretary, guard, manager, otherResident] = await Promise.all([
    login(ACCOUNTS.resident), login(ACCOUNTS.treasurer), login(ACCOUNTS.secretary),
    login(ACCOUNTS.guard), login(ACCOUNTS.manager), login(ACCOUNTS.otherResident),
  ]);
});

after(stopTestServer);

/* ------------------------------------------------------------------ auth */

describe("authentication", () => {
  test("health check reports the database is reachable", async () => {
    const { status, body } = await get("/health");
    assert.equal(status, 200);
    assert.equal(body.ok, true);
  });

  test("valid credentials return tokens and the user", async () => {
    const { status, body } = await post("/api/auth/login", { email: ACCOUNTS.resident, password: "password123" });
    assert.equal(status, 200);
    assert.ok(body.accessToken && body.refreshToken);
    assert.equal(body.user.email, ACCOUNTS.resident);
    assert.equal(body.user.flat, "A-401");
    assert.equal(body.user.role, "resident");
  });

  test("the response never carries the password hash", async () => {
    const { body } = await post("/api/auth/login", { email: ACCOUNTS.resident, password: "password123" });
    assert.equal(JSON.stringify(body).includes("scrypt$"), false);
  });

  test("a wrong password is rejected", async () => {
    const { status } = await post("/api/auth/login", { email: ACCOUNTS.resident, password: "wrong-password" });
    assert.equal(status, 401);
  });

  test("an unknown account gives the same answer as a wrong password", async () => {
    const unknown = await post("/api/auth/login", { email: "nobody@greenvalley.in", password: "password123" });
    const wrong = await post("/api/auth/login", { email: ACCOUNTS.resident, password: "not-it-either" });
    assert.equal(unknown.status, 401);
    assert.deepEqual(unknown.body.error.message, wrong.body.error.message);
  });

  test("a malformed email is refused before touching the database", async () => {
    const { status, body } = await post("/api/auth/login", { email: "not-an-email", password: "password123" });
    assert.equal(status, 422);
    assert.ok(body.error.details.email);
  });

  test("protected routes reject a missing or junk token", async () => {
    assert.equal((await get("/api/me")).status, 401);
    assert.equal((await get("/api/me", "not-a-real-token")).status, 401);
  });

  test("a refresh token rotates and the old one stops working", async () => {
    const session = await login(ACCOUNTS.resident);
    const first = await post("/api/auth/refresh", { refreshToken: session.refreshToken });
    assert.equal(first.status, 200);

    const replay = await post("/api/auth/refresh", { refreshToken: session.refreshToken });
    assert.equal(replay.status, 401, "a replayed refresh token must be dead");

    const rotated = await get("/api/me", first.body.accessToken);
    assert.equal(rotated.status, 200);
  });

  test("a suspended account loses access immediately, without waiting for expiry", async () => {
    const session = await login(ACCOUNTS.otherResident);
    assert.equal((await get("/api/me", session.accessToken)).status, 200);

    await query("UPDATE users SET status = 'suspended' WHERE email = $1", [ACCOUNTS.otherResident]);
    const after = await get("/api/me", session.accessToken);
    assert.equal(after.status, 403, "the token is still valid but the account is not");

    await query("UPDATE users SET status = 'active' WHERE email = $1", [ACCOUNTS.otherResident]);
  });

  test("/api/me returns the capabilities the client should render from", async () => {
    const res = await get("/api/me", resident.accessToken);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.capabilities, []);
    assert.equal(res.body.flat.code, "A-401");

    const t = await get("/api/me", treasurer.accessToken);
    assert.ok(t.body.capabilities.includes("billing.approve"));
    assert.ok(!t.body.capabilities.includes("gate.operate"));
  });
});

/* --------------------------------------------------------- authorization */

describe("authorization", () => {
  test("a resident cannot start a billing run", async () => {
    const { status, body } = await post("/api/bills/runs", { cycle: shiftCycle(currentCycle(), 1) }, resident.accessToken);
    assert.equal(status, 403);
    assert.match(body.error.message, /role \(resident\)/);
  });

  test("a guard cannot start a billing run either", async () => {
    const { status } = await post("/api/bills/runs", { cycle: shiftCycle(currentCycle(), 1) }, guard.accessToken);
    assert.equal(status, 403);
  });

  test("a resident cannot read the society audit trail", async () => {
    assert.equal((await get("/api/me/audit", resident.accessToken)).status, 403);
    assert.equal((await get("/api/me/audit", treasurer.accessToken)).status, 200);
  });

  test("a resident cannot see another flat's bills even by asking for them", async () => {
    const { status, body } = await get("/api/bills?flatCode=C-105", resident.accessToken);
    assert.equal(status, 200);
    assert.ok(body.bills.length > 0);
    assert.ok(body.bills.every((b) => b.flatCode === "A-401"), "the flatCode filter must not widen a resident's scope");
  });

  test("a resident cannot approve a registration", async () => {
    const { body } = await get("/api/registrations", treasurer.accessToken);
    const pending = body.registrations[0];
    assert.equal((await post(`/api/registrations/${pending.id}/approve`, {}, resident.accessToken)).status, 403);
  });

  test("a number is masked from neighbours by default and visible to the committee", async () => {
    const asResident = await get("/api/me/directory", resident.accessToken);
    const asCommittee = await get("/api/me/directory", treasurer.accessToken);

    const pick = (r, flat) => r.body.residents.find((x) => x.flat === flat);
    assert.match(pick(asResident, "D-101").phone, /••••/, "no opt-in means no number");
    assert.match(pick(asCommittee, "D-101").phone, /^\d{10}$/);
  });

  test("a resident who opted in shares their number with neighbours", async () => {
    const { body } = await get("/api/me/directory", resident.accessToken);
    const optedIn = body.residents.find((x) => x.flat === "D-102");
    assert.match(optedIn.phone, /^\d{10}$/, "shareContact is explicit consent to publish");
  });

  test("wanting community notifications is not consent to publish a number", async () => {
    await patch("/api/me", { notify: { community: true } }, otherResident.accessToken);
    const { body } = await get("/api/me/directory", resident.accessToken);
    const them = body.residents.find((x) => x.flat === "C-105");
    assert.match(them.phone, /••••/, "a notification preference must not double as a privacy setting");
  });

  test("residents always see their own number unmasked", async () => {
    const { body } = await get("/api/me/directory", resident.accessToken);
    const me = body.residents.find((x) => x.flat === "A-401" && x.relation === "owner");
    assert.match(me.phone, /^\d{10}$/);
  });
});

/* ----------------------------------------------------------------- gate */

describe("gate lifecycle", () => {
  let visitorId;

  test("a guard records an arrival", async () => {
    const { status, body } = await post("/api/visitors", {
      name: "Ramesh Kumar", category: "guest", flatCode: "A-401", purpose: "Personal visit",
    }, guard.accessToken);
    assert.equal(status, 201);
    assert.equal(body.visitor.status, "waiting");
    assert.match(body.visitor.raisedBy, /^Guard ·/);
    visitorId = body.visitor.id;
  });

  test("a resident cannot record an arrival at the gate", async () => {
    const { status } = await post("/api/visitors", {
      name: "Someone", category: "guest", flatCode: "A-401", status: "waiting",
    }, resident.accessToken);
    assert.equal(status, 403);
  });

  test("a resident cannot raise a visitor for another flat", async () => {
    const { status } = await post("/api/visitors", {
      name: "Someone", category: "guest", flatCode: "C-105", status: "pre-approved",
    }, resident.accessToken);
    assert.equal(status, 403);
  });

  test("a waiting visitor cannot be admitted before the flat approves", async () => {
    const { status, body } = await patch(`/api/visitors/${visitorId}/status`, { status: "inside" }, guard.accessToken);
    assert.equal(status, 409);
    assert.match(body.error.message, /cannot go from waiting to inside/);
  });

  test("the guard sends the request to the flat", async () => {
    const { status, body } = await patch(`/api/visitors/${visitorId}/status`, { status: "pending" }, guard.accessToken);
    assert.equal(status, 200);
    assert.equal(body.visitor.status, "pending");
    assert.ok(body.visitor.sentAt);
  });

  test("a different flat cannot approve someone else's visitor", async () => {
    const { status } = await patch(`/api/visitors/${visitorId}/status`, { status: "approved" }, otherResident.accessToken);
    assert.equal(status, 403);
  });

  test("the guard cannot approve on the resident's behalf", async () => {
    const { status } = await patch(`/api/visitors/${visitorId}/status`, { status: "approved" }, guard.accessToken);
    assert.equal(status, 403, "approval is the flat's decision, not the gate's");
  });

  test("the resident approves and a pass code is issued", async () => {
    const { status, body } = await patch(`/api/visitors/${visitorId}/status`, { status: "approved" }, resident.accessToken);
    assert.equal(status, 200);
    assert.equal(body.visitor.status, "approved");
    assert.match(body.visitor.passCode, /^[A-Z0-9]{6}$/);
  });

  test("the guard admits, then marks the exit", async () => {
    const admitted = await patch(`/api/visitors/${visitorId}/status`, { status: "inside" }, guard.accessToken);
    assert.equal(admitted.body.visitor.status, "inside");
    assert.ok(admitted.body.visitor.entryAt);

    const exited = await patch(`/api/visitors/${visitorId}/status`, { status: "exited" }, guard.accessToken);
    assert.equal(exited.body.visitor.status, "exited");
    assert.ok(exited.body.visitor.exitAt);
  });

  test("an exited visitor cannot be walked back inside", async () => {
    const { status } = await patch(`/api/visitors/${visitorId}/status`, { status: "inside" }, guard.accessToken);
    assert.equal(status, 409);
  });

  test("a resident's pre-approved pass verifies at the gate and admits in one step", async () => {
    const created = await post("/api/visitors", {
      name: "Kiran Deshpande", category: "guest", flatCode: "A-401", status: "pre-approved", purpose: "Dinner",
    }, resident.accessToken);
    assert.equal(created.status, 201);
    const code = created.body.visitor.passCode;
    assert.match(code, /^[A-Z0-9]{6}$/);

    const verified = await post("/api/visitors/verify-pass", { passCode: code.toLowerCase() }, guard.accessToken);
    assert.equal(verified.status, 200, "verification should be case-insensitive");
    assert.equal(verified.body.visitor.name, "Kiran Deshpande");

    const admitted = await patch(`/api/visitors/${created.body.visitor.id}/status`, { status: "inside" }, guard.accessToken);
    assert.equal(admitted.status, 200);

    const reused = await post("/api/visitors/verify-pass", { passCode: code }, guard.accessToken);
    assert.equal(reused.status, 409, "a pass already used for entry cannot be scanned in again");
  });

  test("an unknown pass code is refused", async () => {
    const { status } = await post("/api/visitors/verify-pass", { passCode: "ZZZZZZ" }, guard.accessToken);
    assert.equal(status, 404);
  });

  test("a resident cannot verify passes at all", async () => {
    const { status } = await post("/api/visitors/verify-pass", { passCode: "ABCDEF" }, resident.accessToken);
    assert.equal(status, 403);
  });

  test("residents see only their own flat's gate traffic", async () => {
    const { body } = await get("/api/visitors", resident.accessToken);
    assert.ok(body.visitors.length > 0);
    assert.ok(body.visitors.every((v) => v.flatCode === "A-401"));
  });

  test("the overstay feed reports anyone past their allowed minutes", async () => {
    const { status, body } = await get("/api/visitors/overstays", guard.accessToken);
    assert.equal(status, 200);
    const amazon = body.overstays.find((v) => v.name === "Amazon Delivery");
    assert.ok(amazon, "the seeded delivery is 44 minutes into a 20-minute limit");
    assert.ok(amazon.overBy > 20, `expected a sizeable overstay, got ${amazon.overBy}`);
  });
});

/* -------------------------------------------------------------- billing */

describe("billing and maker-checker", () => {
  const cycle = shiftCycle(currentCycle(), 1);

  /* The treasurer prepares this run deliberately: she holds billing.approve, so
     she is the only person who can prove the separation-of-duties rule bites
     rather than the capability check catching it first. */
  test("the treasurer prepares a run as maker", async () => {
    const { status, body } = await post("/api/bills/runs", { cycle }, treasurer.accessToken);
    assert.equal(status, 201);
    assert.equal(body.drafted, 150);
    assert.equal(body.status, "pending-approval");
  });

  test("running the same cycle again does not double-charge anyone", async () => {
    const { status } = await post("/api/bills/runs", { cycle }, treasurer.accessToken);
    assert.equal(status, 409);

    const { rows } = await query("SELECT count(*)::int AS n FROM bills WHERE cycle = $1", [cycle]);
    assert.equal(rows[0].n, 150);
  });

  test("residents cannot see draft bills", async () => {
    const { body } = await get(`/api/bills?cycle=${cycle}`, resident.accessToken);
    assert.equal(body.bills.length, 0, "an unapproved draft is not a bill yet");
  });

  test("the maker cannot approve their own run, despite holding the capability", async () => {
    const { status, body } = await post(`/api/bills/runs/${cycle}/approve`, {}, treasurer.accessToken);
    assert.equal(status, 403);
    assert.equal(body.error.details.reason, "maker_is_checker");
  });

  test("the run tells each officer whether they may approve it, and why not", async () => {
    const asMaker = await get(`/api/bills/runs/${cycle}`, treasurer.accessToken);
    assert.equal(asMaker.body.canApprove, false);
    assert.equal(asMaker.body.approvalBlockedBy, "maker_is_checker");

    const asStaff = await get(`/api/bills/runs/${cycle}`, manager.accessToken);
    assert.equal(asStaff.body.canApprove, false);
    assert.equal(asStaff.body.approvalBlockedBy, "no_approve_capability");

    const asChecker = await get(`/api/bills/runs/${cycle}`, secretary.accessToken);
    assert.equal(asChecker.body.canApprove, true);
    assert.equal(asChecker.body.drafts, 150);
  });

  test("a second officer approves and the bills reach residents", async () => {
    const { status, body } = await post(`/api/bills/runs/${cycle}/approve`, {}, secretary.accessToken);
    assert.equal(status, 200);
    assert.equal(body.issued, 150);

    const asResident = await get(`/api/bills?cycle=${cycle}`, resident.accessToken);
    assert.equal(asResident.body.bills.length, 1);
    assert.equal(asResident.body.bills[0].status, "issued");
  });

  test("approving twice is refused rather than silently reissuing", async () => {
    const { status } = await post(`/api/bills/runs/${cycle}/approve`, {}, secretary.accessToken);
    assert.equal(status, 404);
  });

  test("the database refuses a maker-approved bill even if the API were bypassed", async () => {
    await assert.rejects(
      () => query(
        `UPDATE bills SET approved_by = maker_id WHERE cycle = $1 AND maker_id IS NOT NULL`,
        [cycle],
      ),
      (err) => err.constraint === "bills_maker_is_not_checker",
      "the CHECK constraint is the backstop for the API rule",
    );
  });

  test("bill amounts match the shared calculator, per flat", async () => {
    const { rows } = await query(
      `SELECT b.total, b.subtotal, b.gst, f.area, f.occupancy, f.parking_slots
         FROM bills b JOIN flats f ON f.id = b.flat_id
        WHERE b.cycle = $1 ORDER BY f.code LIMIT 5`,
      [cycle],
    );
    const { computeBill, DEFAULT_HEADS } = await import("@gvs/shared");
    for (const r of rows) {
      const expected = computeBill({ area: r.area, occupancy: r.occupancy }, DEFAULT_HEADS, r.parking_slots);
      assert.equal(r.total, expected.total);
      assert.equal(r.gst, expected.gst);
    }
  });

  test("a resident pays their own bill and gets a receipt with the flat in the narration", async () => {
    const { body } = await get(`/api/bills?cycle=${cycle}`, resident.accessToken);
    const bill = body.bills[0];

    const paid = await post(`/api/bills/${bill.id}/pay`, { mode: "UPI" }, resident.accessToken);
    assert.equal(paid.status, 201);
    assert.equal(paid.body.payment.amount, bill.total);
    assert.match(paid.body.payment.narration, /UPI\/CR\/GVS\/A-401\//);
    assert.match(paid.body.payment.receiptNo, /^RCT-/);
    assert.ok(new Date(paid.body.payment.settledAt) > new Date(paid.body.payment.paidAt));
  });

  test("paying the same bill twice is refused", async () => {
    const { body } = await get(`/api/bills?cycle=${cycle}`, resident.accessToken);
    const { status } = await post(`/api/bills/${body.bills[0].id}/pay`, { mode: "UPI" }, resident.accessToken);
    assert.equal(status, 409);
  });

  test("a payment writes exactly one ledger entry", async () => {
    const { body } = await get(`/api/bills?cycle=${cycle}`, resident.accessToken);
    const { rows } = await query(
      "SELECT count(*)::int AS n FROM ledger_entries WHERE ref_id = (SELECT id FROM payments WHERE bill_id = $1)",
      [body.bills[0].id],
    );
    assert.equal(rows[0].n, 1);
  });

  test("a resident cannot pay another flat's bill", async () => {
    const { rows } = await query(
      `SELECT b.id FROM bills b JOIN flats f ON f.id = b.flat_id
        WHERE f.code = 'C-105' AND b.status = 'issued' LIMIT 1`,
    );
    const { status } = await post(`/api/bills/${rows[0].id}/pay`, { mode: "UPI" }, resident.accessToken);
    assert.equal(status, 403);
  });

  test("a rejected run leaves nothing behind", async () => {
    const scratch = shiftCycle(currentCycle(), 4);
    await post("/api/bills/runs", { cycle: scratch }, manager.accessToken);
    const rejected = await del(`/api/bills/runs/${scratch}`, treasurer.accessToken);
    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.rejected, 150);

    const { rows } = await query("SELECT count(*)::int AS n FROM bills WHERE cycle = $1", [scratch]);
    assert.equal(rows[0].n, 0);
  });

  test("every billing decision is written to the audit trail", async () => {
    const { body } = await get("/api/me/audit", treasurer.accessToken);
    const actions = body.audit.map((a) => a.action);
    assert.ok(actions.includes("billing.generate"));
    assert.ok(actions.includes("billing.approve"));
    assert.ok(actions.includes("payment.receive"));

    const approval = body.audit.find((a) => a.action === "billing.approve" && a.entity === `Run ${cycle}`);
    assert.equal(approval.actorName, "Suresh Joshi", "the trail names the officer who signed off");

    const prepared = body.audit.find((a) => a.action === "billing.generate" && a.entity === `Run ${cycle}`);
    assert.equal(prepared.actorName, "Meena Patil");
    assert.notEqual(prepared.actor, approval.actor, "maker and checker are two different people on the record");
  });
});

/* ------------------------------------------------------------- helpdesk */

describe("helpdesk", () => {
  let ticketId;
  let plumber;

  before(async () => { plumber = await login(ACCOUNTS.plumber); });

  test("a resident raises a ticket and the SLA clock is set from the priority", async () => {
    const { status, body } = await post("/api/tickets", {
      title: "Kitchen tap is leaking", category: "Plumbing", priority: "high", body: "Dripping since morning",
    }, resident.accessToken);
    assert.equal(status, 201);
    assert.match(body.ticket.ref, /^HD-\d+$/);
    assert.equal(body.ticket.status, "open");

    const hours = (new Date(body.ticket.slaDueAt) - new Date(body.ticket.at)) / 3.6e6;
    assert.ok(Math.abs(hours - 4) < 0.1, `high priority should be a 4-hour SLA, got ${hours}`);
    ticketId = body.ticket.id;
  });

  test("reference numbers are unique under concurrent submissions", async () => {
    const results = await Promise.all(Array.from({ length: 5 }, (_, i) =>
      post("/api/tickets", { title: `Concurrent ticket ${i}`, category: "Other", priority: "low" }, resident.accessToken)));
    const refs = results.map((r) => r.body.ticket.ref);
    assert.equal(new Set(refs).size, refs.length, `duplicate refs issued: ${refs.join(", ")}`);
  });

  test("another resident cannot read the ticket", async () => {
    const { status } = await get(`/api/tickets/${ticketId}`, otherResident.accessToken);
    assert.equal(status, 403);
  });

  test("a resident cannot change a ticket's status", async () => {
    const { status } = await patch(`/api/tickets/${ticketId}`, { status: "resolved" }, resident.accessToken);
    assert.equal(status, 403);
  });

  test("assigning a ticket moves it to in-progress", async () => {
    const plumberId = (await get("/api/me", plumber.accessToken)).body.user.id;
    const { status, body } = await patch(`/api/tickets/${ticketId}`, { assignedTo: plumberId }, manager.accessToken);
    assert.equal(status, 200);
    assert.equal(body.ticket.status, "in-progress");
    assert.equal(body.ticket.assignedToName, "Dattatray Pawar");
  });

  test("a ticket cannot be assigned to a resident", async () => {
    const residentId = (await get("/api/me", resident.accessToken)).body.user.id;
    const { status } = await patch(`/api/tickets/${ticketId}`, { assignedTo: residentId }, manager.accessToken);
    assert.equal(status, 409);
  });

  test("the assigned staff member comments and resolves it", async () => {
    const commented = await post(`/api/tickets/${ticketId}/comments`, { text: "Replaced the washer." }, plumber.accessToken);
    assert.equal(commented.status, 201);

    const resolved = await patch(`/api/tickets/${ticketId}`, { status: "resolved" }, plumber.accessToken);
    assert.equal(resolved.status, 200);
    assert.ok(resolved.body.ticket.resolvedAt);

    const detail = await get(`/api/tickets/${ticketId}`, resident.accessToken);
    assert.equal(detail.body.ticket.comments.length, 1);
    assert.equal(detail.body.ticket.comments[0].byName, "Dattatray Pawar");
  });

  test("only the resident who raised it may rate, and only once", async () => {
    assert.equal((await post(`/api/tickets/${ticketId}/rating`, { rating: 5 }, manager.accessToken)).status, 403);

    const rated = await post(`/api/tickets/${ticketId}/rating`, { rating: 4 }, resident.accessToken);
    assert.equal(rated.status, 200);
    assert.equal(rated.body.ticket.rating, 4);
    assert.equal(rated.body.ticket.status, "closed");

    const again = await post(`/api/tickets/${ticketId}/rating`, { rating: 1 }, resident.accessToken);
    assert.equal(again.status, 409);
  });

  test("an out-of-range rating is rejected", async () => {
    const { status } = await post(`/api/tickets/${ticketId}/rating`, { rating: 9 }, resident.accessToken);
    assert.equal(status, 422);
  });
});

/* --------------------------------------------------------- registration */

describe("resident registration", () => {
  const applicant = { name: "Nikhil Bhat", flatCode: "E-604", relation: "owner", phone: "9876500123", email: "nikhil.new@email.com", password: "a-good-password" };

  test("an application for a flat that does not exist is refused", async () => {
    const { status, body } = await post("/api/auth/register", { ...applicant, flatCode: "Z-999" });
    assert.equal(status, 409);
    assert.match(body.error.message, /not on the society register/);
  });

  test("a valid application is stored as pending, not as an account", async () => {
    const { status, body } = await post("/api/auth/register", applicant);
    assert.equal(status, 201);
    assert.equal(body.status, "pending");

    const login = await post("/api/auth/login", { email: applicant.email, password: applicant.password });
    assert.equal(login.status, 401, "an unapproved applicant cannot sign in");
  });

  test("applying twice is refused", async () => {
    const { status } = await post("/api/auth/register", applicant);
    assert.equal(status, 409);
  });

  test("the committee approves and the applicant can then sign in", async () => {
    const listed = await get("/api/registrations", secretary.accessToken);
    const pending = listed.body.registrations.find((r) => r.email === applicant.email);
    assert.ok(pending);

    const approved = await post(`/api/registrations/${pending.id}/approve`, {}, secretary.accessToken);
    assert.equal(approved.status, 200);
    assert.equal(approved.body.user.flat, "E-604");

    const session = await post("/api/auth/login", { email: applicant.email, password: applicant.password });
    assert.equal(session.status, 200);
    assert.equal(session.body.user.role, "resident");
  });

  test("approving the same application twice is refused", async () => {
    const listed = await get("/api/registrations?status=approved", secretary.accessToken);
    const done = listed.body.registrations.find((r) => r.email === applicant.email);
    const { status } = await post(`/api/registrations/${done.id}/approve`, {}, secretary.accessToken);
    assert.equal(status, 409);
  });

  test("a rejected application records the reason", async () => {
    const listed = await get("/api/registrations", secretary.accessToken);
    const pending = listed.body.registrations[0];
    const { status, body } = await post(`/api/registrations/${pending.id}/reject`,
      { reason: "Rent agreement not attached" }, secretary.accessToken);
    assert.equal(status, 200);
    assert.equal(body.status, "rejected");

    const { rows } = await query("SELECT reason FROM registrations WHERE id = $1", [pending.id]);
    assert.equal(rows[0].reason, "Rent agreement not attached");
  });
});

/* ------------------------------------------------------------- profile */

describe("profile", () => {
  test("a resident updates their own notification preferences", async () => {
    const { status, body } = await patch("/api/me", { notify: { community: true } }, resident.accessToken);
    assert.equal(status, 200);
    assert.equal(body.user.notify.community, true);
    assert.equal(body.user.notify.visitors, true, "existing preferences are preserved");
  });

  test("changing the password revokes sessions elsewhere", async () => {
    const session = await login(ACCOUNTS.otherResident);
    const changed = await post("/api/me/password",
      { currentPassword: "password123", newPassword: "brand-new-password" }, session.accessToken);
    assert.equal(changed.status, 204);

    const replay = await post("/api/auth/refresh", { refreshToken: session.refreshToken });
    assert.equal(replay.status, 401);

    const old = await post("/api/auth/login", { email: ACCOUNTS.otherResident, password: "password123" });
    assert.equal(old.status, 401);

    const fresh = await post("/api/auth/login", { email: ACCOUNTS.otherResident, password: "brand-new-password" });
    assert.equal(fresh.status, 200);
  });

  test("the wrong current password is refused", async () => {
    const { status } = await post("/api/me/password",
      { currentPassword: "definitely-wrong", newPassword: "another-password" }, resident.accessToken);
    assert.equal(status, 400);
  });
});

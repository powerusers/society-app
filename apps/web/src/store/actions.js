import { useMemo } from "react";
import {
  computeBill as computeBillShared, narrationFor, receiptNoFor, settlementDueAt, slaDueAt,
} from "@gvs/shared";
import { useApp } from "./index";
import { code6, iso, uid, thisCycle, shiftCycle } from "../lib/format";

/** Domain operations shared by more than one screen. */
export function useActions() {
  const { db, me, add, patch, remove, setColl, setDb, say, logAudit, sel } = useApp();

  return useMemo(() => {
    /* ---------------- gate ---------------- */
    const sendToFlat = (v) => {
      patch("visitors", v.id, { status: "pending", sentAt: iso() });
      say(`Approval request sent to ${v.flatCode}`);
    };

    const approveVisitor = (v, { allowedMins } = {}) => {
      patch("visitors", v.id, {
        status: "approved", approvedAt: iso(), approvedBy: me.id,
        allowedMins: allowedMins ?? (v.category === "delivery" ? db.settings.overstayMins : 240),
        passCode: v.passCode || code6(),
      });
      say("Approved — the guard has been notified.");
      logAudit("visitor.approve", v.name, `${v.category} for ${v.flatCode}`);
    };

    const denyVisitor = (v, reason = "") => {
      patch("visitors", v.id, { status: "denied", deniedAt: iso(), deniedBy: me.id, denyReason: reason });
      say("Entry denied — the guard has been notified.", "bad");
      logAudit("visitor.deny", v.name, `${v.flatCode}${reason ? ` · ${reason}` : ""}`);
    };

    const admitVisitor = (v) => {
      patch("visitors", v.id, { status: "inside", entryAt: iso(), verifiedBy: me.id });
      say(`${v.name} let in — timer started.`);
    };

    const exitVisitor = (v) => {
      patch("visitors", v.id, { status: "exited", exitAt: iso() });
      say(`${v.name} marked out.`);
    };

    const preApprove = (data) => {
      const v = add("visitors", {
        ...data, status: "pre-approved", raisedBy: "Self", createdBy: me.id,
        createdAt: iso(), passCode: code6(), gateId: data.gateId || "gate_main",
      });
      say("Pre-approved — share the gate pass with your visitor.");
      logAudit("visitor.preapprove", data.name, `${data.category} for ${data.flatCode}`);
      return v;
    };

    const selfCheckin = (data) =>
      add("visitors", {
        ...data, status: "waiting", raisedBy: "QR self check-in", createdAt: iso(), passCode: code6(),
      });

    const raiseIncident = (data) => {
      const i = add("incidents", { ...data, by: me.id, at: iso(), status: "open", recording: `REC-${uid("").slice(-4).toUpperCase()}` });
      say("Incident recorded with timestamp and recording ID.");
      logAudit("incident.create", data.type, data.note?.slice(0, 80));
      return i;
    };

    const logPatrol = (checkpointId, note = "") => {
      add("patrols", { checkpointId, guardId: me.id, at: iso(), note, geo: { lat: 18.52, lng: 73.85 } });
      say("Checkpoint scanned ✓");
    };

    const markHelp = (help, direction) => {
      const now = iso();
      if (direction === "in") {
        patch("dailyHelp", help.id, { status: "in", lastIn: now });
        add("attendance", { helpId: help.id, date: now.slice(0, 10), inAt: now, outAt: null, mode: help.biometric ? "biometric" : "qr", gateId: me.gate || "gate_main" });
        say(`${help.name} checked in`);
      } else {
        patch("dailyHelp", help.id, { status: "out" });
        setColl("attendance", (list) => {
          const idx = list.findIndex((a) => a.helpId === help.id && !a.outAt);
          if (idx < 0) return list;
          const copy = [...list];
          copy[idx] = { ...copy[idx], outAt: now };
          return copy;
        });
        say(`${help.name} checked out`);
      }
    };

    /* ---------------- helpdesk ---------------- */
    const slaFor = (priority) => slaDueAt(priority, db.settings.slaHours).toISOString();

    const raiseTicket = (data) => {
      const n = db.tickets.length + 2045;
      const t = add("tickets", {
        ...data, ref: `HD-${n}`, raisedBy: me.id, flatCode: data.flatCode || me.flat,
        status: "open", at: iso(), slaDueAt: slaFor(data.priority), comments: [], rating: null,
        source: data.source || "app",
      });
      say(`Ticket ${t.ref} raised — SLA ${db.settings.slaHours[data.priority]}h`);
      logAudit("ticket.create", t.ref, data.title);
      return t;
    };

    const commentTicket = (t, text) =>
      patch("tickets", t.id, (x) => ({ comments: [...x.comments, { id: uid("tc"), by: me.id, at: iso(), text }] }));

    const setTicketStatus = (t, status, extra = {}) => {
      patch("tickets", t.id, { status, ...(status === "resolved" ? { resolvedAt: iso() } : {}), ...extra });
      logAudit("ticket.status", t.ref, status);
      say(`${t.ref} → ${status}`);
    };

    /* ---------------- community ---------------- */
    const postNotice = (data) => {
      const n = add("notices", { ...data, author: me.id, at: iso(), reactions: {}, comments: [], readBy: [me.id] });
      say("Notice published to all residents.");
      logAudit("notice.post", data.title, data.priority);
      return n;
    };

    const react = (noticeId, emoji) =>
      patch("notices", noticeId, (n) => ({ reactions: { ...n.reactions, [emoji]: (n.reactions[emoji] || 0) + 1 } }));

    const markRead = (noticeId) =>
      patch("notices", noticeId, (n) => ((n.readBy || []).includes(me.id) ? {} : { readBy: [...(n.readBy || []), me.id] }));

    const vote = (poll, optionId) => {
      if (poll.voters?.[me.id]) return say("You have already voted in this poll.", "bad");
      patch("polls", poll.id, (p) => ({
        options: p.options.map((o) => (o.id === optionId ? { ...o, votes: o.votes + 1 } : o)),
        voters: { ...p.voters, [me.id]: optionId },
      }));
      say("Vote recorded ✓");
    };

    /* The demo poll is shaped like the seeded ones — a voters map and per-option
       counts — so the same normalisation in the repository can hide the tallies
       here too, and the demo behaves like the real thing. */
    const createPoll = ({ question, options, days = 7 }) => {
      const p = add("polls", {
        question, createdBy: me.id, at: iso(),
        closesAt: new Date(Date.now() + Number(days) * 864e5).toISOString(),
        options: options.map((text, i) => ({ id: `o${i}`, text, votes: 0 })),
        voters: {},
      });
      say("Poll published ✓");
      logAudit("poll.create", question, `${options.length} options`);
      return p;
    };

    /* The residents' board in demo mode. `likes` stays a counter here because
       the seeded posts arrive with one; the live board counts people. */
    const createPost = ({ type, title, body, price }) => {
      const p = add("forum", {
        type, title, body: body || "", by: me.id, at: iso(), likes: 0, comments: [],
        ...(type === "classified" ? { price: Number(price || 0) } : {}),
      });
      say("Posted to the community ✓");
      return p;
    };

    const likePost = (id) => patch("forum", id, (p) => ({ likes: p.likes + 1 }));

    const replyToPost = (id, text) =>
      patch("forum", id, (p) => ({ comments: [...p.comments, { id: uid("fc"), by: me.id, at: iso(), text }] }));

    const removePost = (id) => { remove("forum", id); say("Post removed"); };

    const book = (data) => {
      const clash = db.bookings.some((b) => b.amenityId === data.amenityId && b.date === data.date && b.slot === data.slot && b.status !== "cancelled");
      if (clash) { say("That slot is already booked.", "bad"); return null; }
      /* Whether it needs approving is the amenity's property here too, so the
         demo behaves like the live board rather than guessing from the amount. */
      const a = sel.amenity(data.amenityId);
      const b = add("bookings", {
        ...data, userId: me.id, flatCode: me.flat, amount: a?.charge ?? data.amount ?? 0,
        status: a?.requiresApproval ? "pending" : "confirmed",
      });
      say(b.status === "pending" ? "Requested — committee approval needed for this amenity." : "Booked ✓");
      logAudit("amenity.book", sel.amenity(data.amenityId)?.name, `${data.date} ${data.slot}`);
      return b;
    };

    const decideBooking = (id, status) => patch("bookings", id, { status, decidedAt: iso(), decidedBy: me.id });

    const addVehicle = (data) => {
      const v = add("vehicles", {
        ...data, ownerId: me.id, flatCode: me.flat,
        sticker: String(db.vehicles.length + 501).padStart(4, "0"),
      });
      logAudit("vehicle.add", v.number, `${v.kind} · ${me.flat}`);
      return v;
    };

    const removeVehicle = (id) => { remove("vehicles", id); say("Vehicle removed"); };

    const addHelp = (data) => {
      const h = add("dailyHelp", {
        ...data, flats: [me.flat], cardCode: code6(), verified: true,
        rating: 5, status: "out", lastIn: null, photo: null,
      });
      logAudit("help.add", h.name, `${h.role} for ${me.flat}`);
      return h;
    };

    const updateHelp = (id, body) => patch("dailyHelp", id, body);

    const removeHelp = (id) => { remove("dailyHelp", id); say("Removed from your flat"); };

    const rateHelp = (id, stars) => { patch("dailyHelp", id, { rating: stars }); say("Rating saved"); };

    const addAmenity = (data) => add("amenities", { ...data, active: true });

    const addClass = (data) => add("classes", { ...data, enrolled: 0 });

    /* Demo enrolment stays a counter because the seeded classes arrive with
       one; the live board counts people. */
    const enrol = (id) => patch("classes", id, (c) => ({ enrolled: c.enrolled + 1 }));

    /* ---------------- billing / accounts ---------------- */
    /* Preview only. When the API is wired in, the amount a resident is charged is
       whatever the server computed with this same shared function. */
    const computeBill = (flat) => {
      const slots = db.vehicles.filter((v) => v.flatCode === flat.code).length || (flat.type === "3BHK" ? 2 : 1);
      return computeBillShared(flat, db.heads, slots);
    };

    /** Maker step — creates a draft run awaiting the treasurer's approval. */
    const generateBills = (cycle) => {
      const existing = new Set(db.bills.filter((b) => b.cycle === cycle).map((b) => b.flatCode));
      const drafts = db.flats
        .filter((f) => !existing.has(f.code))
        .map((f) => {
          const { items, subtotal, gst, total } = computeBill(f);
          return {
            id: `bill_${f.code}_${cycle}`, cycle, flatCode: f.code, items, subtotal, gst, lateFee: 0, total,
            dueDate: `${cycle}-10`, status: "pending-approval", makerId: me.id, createdAt: iso(),
          };
        });
      if (!drafts.length) { say("Bills for this cycle already exist.", "bad"); return 0; }
      setColl("bills", (list) => [...drafts, ...list]);
      logAudit("billing.generate", `Run ${cycle}`, `${drafts.length} draft bills created by maker`);
      say(`${drafts.length} bills drafted — waiting for treasurer approval.`);
      return drafts.length;
    };

    /** Checker step — only a user with billing.approve may issue. */
    const approveRun = (cycle) => {
      let n = 0;
      setColl("bills", (list) => list.map((b) => {
        if (b.cycle !== cycle || b.status !== "pending-approval") return b;
        n++;
        return { ...b, status: "issued", approvedBy: me.id, approvedAt: iso(), issuedAt: iso() };
      }));
      logAudit("billing.approve", `Run ${cycle}`, `${n} bills approved and issued`);
      say(`${n} bills approved and sent to residents.`);
      return n;
    };

    const rejectRun = (cycle, reason) => {
      setColl("bills", (list) => list.filter((b) => !(b.cycle === cycle && b.status === "pending-approval")));
      logAudit("billing.reject", `Run ${cycle}`, reason || "Rejected by checker");
      say("Draft run rejected and removed.", "bad");
    };

    /** Payment + the 30-minute instant settlement promise from the deck. */
    const payBill = (bill, mode = "UPI") => {
      const paidAt = new Date();
      const settleAt = settlementDueAt(paidAt, db.settings.settlementMins);
      const receiptNo = receiptNoFor(bill);
      const p = add("payments", {
        billId: bill.id, flatCode: bill.flatCode, amount: bill.total, mode,
        txnId: `T${Date.now().toString().slice(-10)}`, paidAt: paidAt.toISOString(),
        settledAt: settleAt.toISOString(), reconciled: false,
        narration: narrationFor({ mode, flatCode: bill.flatCode, cycle: bill.cycle }),
        receiptNo,
      });
      patch("bills", bill.id, { status: "paid", paidAt: paidAt.toISOString() });
      add("ledger", {
        date: paidAt.toISOString(), head: "Maintenance income", type: "income", amount: bill.total,
        flatCode: bill.flatCode, mode, note: `Bill ${bill.cycle} · ${bill.flatCode}`, refId: p.id,
      });
      logAudit("payment.receive", receiptNo, `${bill.flatCode} · ${bill.cycle}`);
      say(`Paid ✓ Receipt ${receiptNo}`);
      return p;
    };

    const addLedger = (data) => {
      add("ledger", { ...data, date: data.date || iso() });
      logAudit("ledger.entry", data.head, `${data.type} ${data.amount}`);
      say("Ledger entry recorded.");
    };

    /** Matches an imported MT940 statement against unreconciled payments by flat narration. */
    const reconcile = (lines) => {
      let matched = 0, unmatched = [];
      const byNarration = new Map(db.payments.filter((p) => !p.reconciled).map((p) => [p.narration, p]));
      const ids = [];
      for (const l of lines) {
        const hit = [...byNarration.values()].find((p) => l.narration.includes(p.flatCode) && Math.round(p.amount) === Math.round(l.amount));
        if (hit) { matched++; ids.push(hit.id); byNarration.delete(hit.narration); }
        else unmatched.push(l);
      }
      if (ids.length) setColl("payments", (list) => list.map((p) => (ids.includes(p.id) ? { ...p, reconciled: true, reconciledAt: iso() } : p)));
      logAudit("bank.reconcile", "MT940 import", `${matched} matched, ${unmatched.length} unmatched`);
      return { matched, unmatched };
    };

    /* ---------------- admin ---------------- */
    const approveRegistration = (reg) => {
      patch("registrations", reg.id, { status: "approved", decidedAt: iso(), decidedBy: me.id });
      add("users", {
        id: uid("u"), name: reg.name, flat: reg.flatCode, block: reg.flatCode.split("-")[0], role: "resident",
        relation: reg.relation, phone: reg.phone, email: reg.email, status: "active", joined: iso(),
        notify: { visitors: true, notices: true, payments: true, helpdesk: true, community: true, quietHours: false },
      });
      logAudit("resident.approve", reg.name, reg.flatCode);
      say(`${reg.name} approved and added to ${reg.flatCode}.`);
    };

    const rejectRegistration = (reg, reason) => {
      patch("registrations", reg.id, { status: "rejected", decidedAt: iso(), decidedBy: me.id, reason });
      logAudit("resident.reject", reg.name, reason || "");
      say(`${reg.name}'s registration rejected.`, "bad");
    };

    return {
      sendToFlat, approveVisitor, denyVisitor, admitVisitor, exitVisitor, preApprove, selfCheckin,
      raiseIncident, logPatrol, markHelp,
      raiseTicket, commentTicket, setTicketStatus, slaFor,
      postNotice, react, markRead, vote, createPoll, book,
      createPost, likePost, replyToPost, removePost,
      decideBooking, addAmenity, addClass, enrol, addVehicle, removeVehicle,
      addHelp, updateHelp, removeHelp, rateHelp,
      computeBill, generateBills, approveRun, rejectRun, payBill, addLedger, reconcile,
      approveRegistration, rejectRegistration,
      cycles: { current: thisCycle(), next: shiftCycle(thisCycle(), 1) },
    };
  }, [db, me, add, patch, remove, setColl, setDb, say, logAudit, sel]);
}

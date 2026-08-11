import { fileURLToPath } from "node:url";
import { DEFAULT_HEADS, computeBill, currentCycle, shiftCycle, narrationFor, receiptNoFor } from "@gvs/shared";
import { config } from "../config.js";
import { pool, tx, closePool } from "./pool.js";
import { migrate } from "./migrate.js";
import { hashPassword } from "../lib/password.js";

/* A demo society matching the web app's seed, so both halves tell the same story.
   Passwords are identical across demo accounts on purpose — this is seed data,
   not a production import. */
const DEMO_PASSWORD = process.env.SEED_PASSWORD || "password123";

const BLOCKS = ["A", "B", "C", "D", "E"];
const FLOORS = 6;
const PER_FLOOR = 5;

let s = 987654321;
const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const chance = (p) => rnd() < p;

const FIRST = ["Rahul", "Priya", "Amit", "Sneha", "Vikram", "Meena", "Suresh", "Kavita", "Arjun", "Divya",
  "Rohit", "Anita", "Sanjay", "Pooja", "Nikhil", "Rekha", "Manoj", "Shalini", "Deepak", "Neha"];
const LAST = ["Mehta", "Sharma", "Patel", "Reddy", "Singh", "Patil", "Joshi", "Kulkarni", "Iyer", "Nair",
  "Deshmukh", "Gupta", "Bose", "Rao", "Shetty", "Chavan"];
const personName = () => `${pick(FIRST)} ${pick(LAST)}`;
const phone = () => `9${int(1, 8)}${String(int(10000000, 99999999)).slice(0, 8)}`;

const FIXED = {
  "A-401": { name: "Rahul Mehta", role: "resident", email: "rahul@greenvalley.in" },
  "B-201": { name: "Meena Patil", role: "committee", email: "meena@greenvalley.in", designation: "Treasurer" },
  "A-101": { name: "Suresh Joshi", role: "admin", email: "suresh@greenvalley.in", designation: "Secretary" },
};

export async function seed({ silent = false } = {}) {
  s = 987654321;
  const log = (...a) => !silent && console.log(...a);
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  return tx(async (c) => {
    const already = await c.query("SELECT id FROM societies LIMIT 1");
    if (already.rows.length) {
      /* This is not an upsert — it destroys every flat, bill, payment and
         audit row in the database. Harmless against a dev box, unrecoverable
         against a deployed one, so production has to say so out loud. */
      if (config.isProd && process.env.SEED_CONFIRM !== "wipe") {
        throw new Error(
          "Refusing to reseed: this database already holds a society, and seeding " +
          "TRUNCATEs every table. Re-run with SEED_CONFIRM=wipe if that is genuinely what you want.",
        );
      }
      log("[seed] a society already exists — wiping and reseeding");
      await c.query("TRUNCATE societies CASCADE");
      await c.query("ALTER SEQUENCE ticket_ref_seq RESTART WITH 2045");
    }

    const { rows: [society] } = await c.query(
      `INSERT INTO societies (name, address, reg_no, gstin, settings, bank)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb) RETURNING id`,
      [
        "Green Valley Society", "Baner Road, Pune 411045", "PNA/GNL/(O)/HSG/(TC)/9214/2011", "27AABCG1234M1Z5",
        JSON.stringify({
          lateFeePct: 2, gracePeriodDays: 0, overstayMins: 20, settlementMins: 30,
          slaHours: { high: 4, medium: 24, low: 72 }, finYear: "2026-27", blocks: BLOCKS,
        }),
        JSON.stringify({ name: "HDFC Bank — Baner", account: "50200012345678", ifsc: "HDFC0000123" }),
      ],
    );

    const gates = [];
    for (const [name, device, features] of [
      ["Main Gate", "NBH-TAB-01", ["qr", "biometric", "walkie", "anpr"]],
      ["Service Gate", "NBH-TAB-02", ["qr", "biometric", "walkie"]],
      ["Clubhouse Gate", "NBH-TAB-03", ["qr", "walkie"]],
    ]) {
      const { rows } = await c.query(
        "INSERT INTO gates (society_id, name, device, features) VALUES ($1,$2,$3,$4) RETURNING id, name",
        [society.id, name, device, features],
      );
      gates.push(rows[0]);
    }

    for (const [i, h] of DEFAULT_HEADS.entries()) {
      await c.query(
        "INSERT INTO charge_heads (society_id, code, name, basis, rate, gst, sort) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [society.id, h.id, h.name, h.basis, h.rate, h.gst, i],
      );
    }

    /* ---- flats and residents ---- */
    const flats = [];
    for (const b of BLOCKS) {
      for (let fl = 1; fl <= FLOORS; fl++) {
        for (let n = 1; n <= PER_FLOOR; n++) {
          const code = `${b}-${fl}0${n}`;
          const type = chance(0.35) ? "3BHK" : "2BHK";
          const area = type === "3BHK" ? int(1150, 1420) : int(820, 1040);
          const occupancy = chance(0.22) ? "tenant" : "owner-occupied";
          const slots = type === "3BHK" ? 2 : 1;
          const { rows } = await c.query(
            `INSERT INTO flats (society_id, code, block, floor, type, area, occupancy, parking_slots)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [society.id, code, b, fl, type, area, occupancy, slots],
          );
          flats.push(rows[0]);

          const fixed = FIXED[code];
          await c.query(
            `INSERT INTO users (society_id, name, email, phone, password_hash, role, designation, relation, flat_id, notify)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'owner',$8,$9::jsonb)`,
            [
              society.id, fixed?.name || personName(),
              fixed?.email || `resident.${code.toLowerCase()}@greenvalley.in`,
              phone(), passwordHash, fixed?.role || "resident", fixed?.designation || null, rows[0].id,
              JSON.stringify({ visitors: true, notices: true, payments: true, helpdesk: true, community: !fixed, quietHours: false, shareContact: code === "D-102" }),
            ],
          );
        }
      }
    }

    const flatByCode = new Map(flats.map((f) => [f.code, f]));

    // co-owner on the demo flat, so the family view has something in it
    await c.query(
      `INSERT INTO users (society_id, name, email, phone, password_hash, role, relation, flat_id, notify)
       VALUES ($1,'Sneha Reddy','sneha@greenvalley.in',$2,$3,'resident','co-owner',$4,'{}'::jsonb)`,
      [society.id, phone(), passwordHash, flatByCode.get("A-401").id],
    );

    const staff = [];
    for (const [name, email, role, designation, gateIdx, shift] of [
      ["Mohan Singh", "mohan@greenvalley.in", "guard", null, 0, "06:00 – 14:00"],
      ["Ravi Yadav", "ravi@greenvalley.in", "guard", null, 1, "14:00 – 22:00"],
      ["Sunil Kamble", "sunil@greenvalley.in", "guard", null, 2, "22:00 – 06:00"],
      ["Ganesh Rane", "manager@greenvalley.in", "staff", "Facility Manager", null, null],
      ["Imran Shaikh", "electric@greenvalley.in", "staff", "Electrician", null, null],
      ["Dattatray Pawar", "plumb@greenvalley.in", "staff", "Plumber", null, null],
    ]) {
      const { rows } = await c.query(
        `INSERT INTO users (society_id, name, email, phone, password_hash, role, designation, gate_id, shift)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, name, role`,
        [society.id, name, email, phone(), passwordHash, role, designation, gateIdx === null ? null : gates[gateIdx].id, shift],
      );
      staff.push(rows[0]);
    }

    const manager = staff.find((u) => u.name === "Ganesh Rane");
    const { rows: [treasurer] } = await c.query("SELECT id FROM users WHERE email = 'meena@greenvalley.in'");
    const { rows: [secretary] } = await c.query("SELECT id FROM users WHERE email = 'suresh@greenvalley.in'");
    const { rows: [rahul] } = await c.query("SELECT id FROM users WHERE email = 'rahul@greenvalley.in'");
    const guard = staff.find((u) => u.name === "Mohan Singh");

    /* ---- three billing cycles: two settled, the current one open ---- */
    const cur = currentCycle();
    const cycles = [shiftCycle(cur, -2), shiftCycle(cur, -1), cur];
    const heads = DEFAULT_HEADS;

    for (const [ci, cycle] of cycles.entries()) {
      const isCurrent = ci === cycles.length - 1;
      for (const f of flats) {
        const { items, subtotal, gst, total } = computeBill(f, heads, f.parking_slots);
        // the demo resident's current bill stays open so the payment flow is visible
        const paid = isCurrent ? (f.code !== "A-401" && chance(0.58)) : chance(0.91);
        const status = paid ? "paid" : isCurrent ? "issued" : "overdue";
        const lateFee = status === "overdue" ? Math.round(total * 0.02) : 0;

        const { rows: [bill] } = await c.query(
          `INSERT INTO bills (society_id, flat_id, cycle, items, subtotal, gst, late_fee, total, due_date, status,
                              maker_id, approved_by, approved_at, issued_at)
           VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,$12,now(),now()) RETURNING id`,
          [
            society.id, f.id, cycle, JSON.stringify(items), subtotal, gst, lateFee, total + lateFee,
            `${cycle}-10`, status, manager.id, treasurer.id,
          ],
        );

        if (paid) {
          const mode = pick(["UPI", "UPI", "UPI", "NetBanking", "Card", "NEFT"]);
          const paidAt = new Date(`${cycle}-0${int(2, 9)}T${String(int(9, 20)).padStart(2, "0")}:${int(10, 59)}:00Z`);
          const { rows: [payment] } = await c.query(
            `INSERT INTO payments (society_id, bill_id, flat_id, amount, mode, txn_id, receipt_no, narration,
                                   paid_at, settled_at, reconciled, reconciled_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
            [
              society.id, bill.id, f.id, total, mode, `T${cycle.replace("-", "")}${int(100000, 999999)}`,
              receiptNoFor({ cycle, flatCode: f.code }), narrationFor({ mode, flatCode: f.code, cycle }),
              paidAt, new Date(paidAt.getTime() + int(9, 28) * 60000),
              // current-cycle credits are still waiting for the MT940 import
              !isCurrent, isCurrent ? null : paidAt,
            ],
          );
          await c.query(
            `INSERT INTO ledger_entries (society_id, entry_date, head, type, amount, flat_id, mode, note, ref_id)
             VALUES ($1,$2,'Maintenance income','income',$3,$4,$5,$6,$7)`,
            [society.id, paidAt, total, f.id, mode, `Bill ${cycle} · ${f.code}`, payment.id],
          );
        }
      }
    }

    /* ---- society expenses ---- */
    for (const cycle of cycles) {
      for (const [head, base] of [
        ["Security agency", 186000], ["Housekeeping", 92000], ["Common electricity", 74500],
        ["Water tanker", 28000], ["Lift AMC", 21000], ["Garden & landscaping", 18500],
        ["STP maintenance", 24000], ["Generator diesel", 16400], ["Pest control", 9500],
      ]) {
        const amount = Math.round(base * (0.9 + rnd() * 0.25));
        await c.query(
          `INSERT INTO ledger_entries (society_id, entry_date, head, type, amount, mode, tds, note)
           VALUES ($1,$2,$3,'expense',$4,$5,$6,$7)`,
          [
            society.id, `${cycle}-${String(int(3, 26)).padStart(2, "0")}T11:00:00Z`, head, amount,
            pick(["NEFT", "Cheque", "UPI"]),
            head.includes("agency") || head.includes("Housekeeping") ? Math.round(amount * 0.02) : 0,
            `${head} — ${cycle}`,
          ],
        );
      }
    }

    /* ---- live gate traffic ---- */
    const mins = (m) => new Date(Date.now() - m * 60000);
    for (const v of [
      { name: "Amazon Delivery", category: "delivery", flat: "A-401", gate: 0, status: "inside", entry: 44, allowed: 20, raised: "Self" },
      { name: "Ramesh Kumar", category: "guest", flat: "A-401", gate: 0, status: "pending", sent: 4, raised: "Guard · Mohan Singh", purpose: "Personal visit" },
      { name: "Flipkart Delivery", category: "delivery", flat: "B-201", gate: 0, status: "waiting", raised: "Guard · Mohan Singh" },
      { name: "Sunita Devi", category: "guest", flat: "C-105", gate: 0, status: "pending", sent: 12, raised: "Guard · Mohan Singh" },
      { name: "CoolAir AC Service", category: "service", flat: "A-101", gate: 1, status: "waiting", raised: "Guard · Ravi Yadav" },
      { name: "Swiggy Delivery", category: "delivery", flat: "D-302", gate: 0, status: "inside", entry: 30, allowed: 15, raised: "QR self check-in" },
    ]) {
      await c.query(
        `INSERT INTO visitors (society_id, flat_id, gate_id, name, category, status, purpose, allowed_mins,
                               raised_by, created_by, sent_at, entry_at, approved_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          society.id, flatByCode.get(v.flat).id, gates[v.gate].id, v.name, v.category, v.status,
          v.purpose || "", v.allowed ?? 240, v.raised, guard.id,
          v.sent ? mins(v.sent) : null, v.entry ? mins(v.entry) : null, v.entry ? mins(v.entry + 1) : null,
          mins(v.entry ? v.entry + 4 : v.sent ? v.sent + 5 : 9),
        ],
      );
    }

    /* ---- helpdesk ---- */
    for (const t of [
      { ref: 2041, title: "Water seepage in bathroom ceiling", cat: "Plumbing", pri: "high", status: "in-progress", flat: "A-401", by: rahul.id, assign: staff.find((u) => u.name === "Dattatray Pawar").id, hours: -30, sla: 3 },
      { ref: 2042, title: "Corridor light not working — A wing 4th floor", cat: "Electrical", pri: "medium", status: "open", flat: "A-401", by: rahul.id, assign: null, hours: -6, sla: 20, source: "ai-call" },
      { ref: 2044, title: "Basement P2 CCTV camera angle changed", cat: "Security", pri: "high", status: "open", flat: "A-101", by: secretary.id, assign: staff.find((u) => u.name === "Imran Shaikh").id, hours: -2, sla: -0.75 },
    ]) {
      await c.query(
        `INSERT INTO tickets (society_id, ref, flat_id, title, body, category, priority, status, source,
                              raised_by, assigned_to, sla_due_at, created_at)
         VALUES ($1,$2,$3,$4,'',$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          society.id, `HD-${t.ref}`, flatByCode.get(t.flat).id, t.title, t.cat, t.pri, t.status,
          t.source || "app", t.by, t.assign,
          new Date(Date.now() + t.sla * 3600e3), new Date(Date.now() + t.hours * 3600e3),
        ],
      );
    }
    await c.query("SELECT setval('ticket_ref_seq', 2045)");

    /* ---- pending registrations for the approval queue ---- */
    for (const [name, code, relation, email] of [
      ["Priya Sharma", "B-302", "owner", "priya.new@email.com"],
      ["Amit Patel", "C-105", "tenant", "amit.new@email.com"],
    ]) {
      await c.query(
        `INSERT INTO registrations (society_id, name, flat_code, relation, phone, email, password_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [society.id, name, code, relation, phone(), email, passwordHash],
      );
    }

    await c.query(
      `INSERT INTO audit_log (society_id, actor_id, action, entity, detail)
       VALUES ($1,$2,'billing.approve',$3,$4)`,
      [society.id, treasurer.id, `Run ${cur}`, `${flats.length} bills approved and issued`],
    );

    log(`[seed] society ${society.id}`);
    log(`[seed] ${flats.length} flats · ${cycles.length} billing cycles · demo password "${DEMO_PASSWORD}"`);
    return { societyId: society.id, flats: flats.length };
  });
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  try {
    await migrate({ silent: true });
    await seed();
  } catch (err) {
    console.error(`[seed] ${err.message}`);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

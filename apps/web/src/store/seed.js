import { DEFAULT_HEADS, computeBill, narrationFor, receiptNoFor } from "@gvs/shared";
import { dayKey, shiftCycle, thisCycle, code6 } from "../lib/format";

/* Deterministic PRNG so the first seed is reproducible across devices. */
let _s = 987654321;
const rnd = () => ((_s = (_s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const chance = (p) => rnd() < p;

const hoursAgo = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const minsAgo = (m) => new Date(Date.now() - m * 60e3).toISOString();
const daysAgo = (d) => new Date(Date.now() - d * 864e5).toISOString();
const inDays = (d) => new Date(Date.now() + d * 864e5).toISOString();
const inMins = (m) => new Date(Date.now() + m * 60e3).toISOString();

const FIRST = ["Rahul", "Priya", "Amit", "Sneha", "Vikram", "Meena", "Suresh", "Kavita", "Arjun", "Divya", "Rohit", "Anita",
  "Sanjay", "Pooja", "Nikhil", "Rekha", "Manoj", "Shalini", "Deepak", "Neha", "Ashok", "Swati", "Karan", "Ritu",
  "Prashant", "Lata", "Girish", "Anjali", "Vivek", "Sarita"];
const LAST = ["Mehta", "Sharma", "Patel", "Reddy", "Singh", "Patil", "Joshi", "Kulkarni", "Iyer", "Nair", "Deshmukh",
  "Gupta", "Bose", "Rao", "Shetty", "Chavan", "Menon", "Kapoor", "Jain", "Bhat"];
const name = () => `${pick(FIRST)} ${pick(LAST)}`;
const phone = () => `9${int(1, 8)}${String(int(10000000, 99999999)).slice(0, 8)}`;

export const BLOCKS = ["A", "B", "C", "D", "E"];
const FLOORS = 6;
const PER_FLOOR = 5;

/* ---------------- flats + people ---------------- */
function buildPeople() {
  const flats = [];
  const users = [];

  const fixed = {
    "A-401": { id: "u_res", name: "Rahul Mehta", role: "resident", email: "rahul@greenvalley.in" },
    "B-201": { id: "u_com", name: "Meena Patil", role: "committee", email: "meena@greenvalley.in", designation: "Treasurer" },
    "A-101": { id: "u_adm", name: "Suresh Joshi", role: "admin", email: "suresh@greenvalley.in", designation: "Secretary" },
  };

  for (const b of BLOCKS) {
    for (let fl = 1; fl <= FLOORS; fl++) {
      for (let n = 1; n <= PER_FLOOR; n++) {
        const codeStr = `${b}-${fl}0${n}`;
        const type = chance(0.28) ? "2BHK" : chance(0.5) ? "3BHK" : "2BHK";
        const area = type === "3BHK" ? int(1150, 1420) : int(820, 1040);
        const tenanted = chance(0.22);
        const f = { id: `flat_${codeStr}`, code: codeStr, block: b, floor: fl, type, area, occupancy: tenanted ? "tenant" : "owner-occupied" };
        flats.push(f);

        const preset = fixed[codeStr];
        const owner = {
          id: preset?.id || `u_${codeStr}`,
          name: preset?.name || name(),
          flat: codeStr,
          block: b,
          role: preset?.role || "resident",
          designation: preset?.designation,
          relation: "owner",
          phone: phone(),
          email: preset?.email || `resident.${codeStr.toLowerCase()}@greenvalley.in`,
          status: "active",
          joined: daysAgo(int(120, 1400)),
          notify: { visitors: true, notices: true, payments: true, helpdesk: true, community: !preset, quietHours: false },
        };
        users.push(owner);
        f.ownerId = owner.id;

        if (tenanted) {
          const t = {
            id: `u_${codeStr}_t`, name: name(), flat: codeStr, block: b, role: "resident", relation: "tenant",
            phone: phone(), email: `tenant.${codeStr.toLowerCase()}@greenvalley.in`, status: "active",
            joined: daysAgo(int(30, 700)),
            notify: { visitors: true, notices: true, payments: false, helpdesk: true, community: true, quietHours: false },
          };
          users.push(t);
          f.tenantId = t.id;
        }
      }
    }
  }

  // co-owner on the demo flat so the "family members" view has something to show
  users.push({
    id: "u_res2", name: "Sneha Reddy", flat: "A-401", block: "A", role: "resident", relation: "co-owner",
    phone: phone(), email: "sneha@greenvalley.in", status: "active", joined: daysAgo(400),
    notify: { visitors: true, notices: true, payments: true, helpdesk: false, community: true, quietHours: true },
  });

  // committee members beyond the two fixed ones
  ["C-302", "D-105", "E-201"].forEach((c, i) => {
    const u = users.find((x) => x.flat === c && x.relation === "owner");
    if (u) { u.role = "committee"; u.designation = ["Chairman", "Joint Secretary", "Member"][i]; }
  });

  // gate + facility staff
  users.push(
    { id: "u_grd", name: "Mohan Singh", role: "guard", phone: phone(), email: "mohan@greenvalley.in", status: "active", gate: "gate_main", shift: "06:00 – 14:00", joined: daysAgo(500), notify: {} },
    { id: "u_grd2", name: "Ravi Yadav", role: "guard", phone: phone(), email: "ravi@greenvalley.in", status: "active", gate: "gate_back", shift: "14:00 – 22:00", joined: daysAgo(300), notify: {} },
    { id: "u_grd3", name: "Sunil Kamble", role: "guard", phone: phone(), email: "sunil@greenvalley.in", status: "active", gate: "gate_club", shift: "22:00 – 06:00", joined: daysAgo(210), notify: {} },
    { id: "u_stf", name: "Ganesh Rane", role: "staff", designation: "Facility Manager", phone: phone(), email: "manager@greenvalley.in", status: "active", joined: daysAgo(620), notify: {} },
    { id: "u_stf2", name: "Imran Shaikh", role: "staff", designation: "Electrician", phone: phone(), email: "electric@greenvalley.in", status: "active", joined: daysAgo(280), notify: {} },
    { id: "u_stf3", name: "Dattatray Pawar", role: "staff", designation: "Plumber", phone: phone(), email: "plumb@greenvalley.in", status: "active", joined: daysAgo(190), notify: {} },
  );

  return { flats, users };
}

/* ---------------- billing ---------------- */
const HEADS = DEFAULT_HEADS;

function buildFinance(flats) {
  const cur = thisCycle();
  const cycles = [shiftCycle(cur, -2), shiftCycle(cur, -1), cur];
  const bills = [];
  const payments = [];
  const ledger = [];

  cycles.forEach((cycle, ci) => {
    const isCurrent = ci === cycles.length - 1;
    for (const f of flats) {
      const slots = f.type === "3BHK" ? 2 : 1;
      const { items, subtotal, gst, total } = computeBill(f, HEADS, slots);
      const dueDate = `${cycle}-10`;
      const overdue = !isCurrent && chance(0.09);
      // The demo resident always has the current cycle open, so the pay + settle flow is visible.
      const paid = !isCurrent ? !overdue : (f.code === "A-401" ? false : chance(0.58));
      const id = `bill_${f.code}_${cycle}`;
      const lateFee = overdue ? Math.round(total * 0.02) : 0;
      bills.push({
        id, cycle, flatCode: f.code, items, subtotal, gst, lateFee, total: total + lateFee,
        dueDate, status: paid ? "paid" : overdue ? "overdue" : "issued",
        makerId: "u_stf", approvedBy: "u_com", approvedAt: `${cycle}-01T10:12:00.000Z`,
        issuedAt: `${cycle}-01T11:00:00.000Z`,
      });

      if (paid) {
        const mode = pick(["UPI", "UPI", "UPI", "NetBanking", "Card", "NEFT"]);
        const day = String(int(2, 9)).padStart(2, "0");
        const at = `${cycle}-${day}T${String(int(9, 20)).padStart(2, "0")}:${String(int(10, 59))}:00.000Z`;
        const pid = `pay_${f.code}_${cycle}`;
        payments.push({
          id: pid, billId: id, flatCode: f.code, amount: total, mode,
          txnId: `T${cycle.replace("-", "")}${String(int(100000, 999999))}`,
          paidAt: at, settledAt: new Date(new Date(at).getTime() + int(9, 28) * 60e3).toISOString(),
          narration: narrationFor({ mode, flatCode: f.code, cycle }),
          receiptNo: receiptNoFor({ cycle, flatCode: f.code }),
          // Current-cycle credits are still sitting in the bank feed, waiting for the MT940 import.
          reconciled: !isCurrent,
        });
        ledger.push({
          id: `led_${pid}`, date: at, head: "Maintenance income", type: "income", amount: total,
          flatCode: f.code, mode, note: `Bill ${cycle} · ${f.code}`, refId: pid,
        });
      }
    }
  });

  // society expenses
  const EXP = [
    ["Security agency", 186000], ["Housekeeping", 92000], ["Common electricity", 74500], ["Water tanker", 28000],
    ["Lift AMC", 21000], ["Garden & landscaping", 18500], ["STP maintenance", 24000], ["Generator diesel", 16400],
    ["Pest control", 9500], ["Accounting & audit", 12000], ["Repairs — plumbing", 14300], ["Repairs — civil", 26800],
  ];
  cycles.forEach((cycle) => {
    EXP.forEach(([head, base], i) => {
      const amt = Math.round(base * (0.9 + rnd() * 0.25));
      ledger.push({
        id: `led_exp_${cycle}_${i}`, date: `${cycle}-${String(int(3, 26)).padStart(2, "0")}T11:00:00.000Z`,
        head, type: "expense", amount: amt, vendor: null, mode: pick(["NEFT", "Cheque", "UPI"]),
        note: `${head} — ${cycle}`, tds: head.includes("agency") || head.includes("Housekeeping") ? Math.round(amt * 0.02) : 0,
      });
    });
  });

  const budgets = [
    ["Security agency", 2280000], ["Housekeeping", 1150000], ["Common electricity", 900000], ["Water tanker", 300000],
    ["Lift AMC", 260000], ["Garden & landscaping", 220000], ["STP maintenance", 290000], ["Generator diesel", 200000],
    ["Pest control", 120000], ["Accounting & audit", 150000], ["Repairs — plumbing", 180000], ["Repairs — civil", 350000],
  ].map(([head, budgeted], i) => ({ id: `bud_${i}`, fy: "2026-27", head, budgeted }));

  return { bills, payments, ledger, budgets, heads: HEADS, cycles };
}

/* ---------------- gate ---------------- */
const DELIVERY_BRANDS = ["Amazon", "Flipkart", "Swiggy", "Zomato", "Blinkit", "BigBasket", "Zepto", "Delhivery"];

function buildGate(flats) {
  const gates = [
    { id: "gate_main", name: "Main Gate", device: "NBH-TAB-01", status: "online", features: ["qr", "biometric", "walkie", "anpr"] },
    { id: "gate_back", name: "Service Gate", device: "NBH-TAB-02", status: "online", features: ["qr", "biometric", "walkie"] },
    { id: "gate_club", name: "Clubhouse Gate", device: "NBH-TAB-03", status: "online", features: ["qr", "walkie"] },
  ];

  const visitors = [];
  const push = (v) => visitors.push({ purpose: "", phone: "", vehicle: "", photo: null, ...v });

  push({
    id: "v_1", name: "Amazon Delivery", category: "delivery", brand: "Amazon", flatCode: "A-401", gateId: "gate_main",
    status: "inside", raisedBy: "Self", createdAt: minsAgo(48), approvedAt: minsAgo(46), entryAt: minsAgo(44),
    allowedMins: 20, passCode: code6(), purpose: "Package delivery",
  });
  push({
    id: "v_2", name: "Ramesh Kumar", category: "guest", flatCode: "A-401", gateId: "gate_main", status: "pending",
    raisedBy: "Guard · Mohan Singh", createdAt: minsAgo(4), phone: "9988776655", purpose: "Personal visit",
  });
  push({
    id: "v_3", name: "Raj Plumbing Services", category: "service", flatCode: "A-401", gateId: "gate_back",
    status: "approved", raisedBy: "Guard · Mohan Singh", createdAt: hoursAgo(3), approvedAt: hoursAgo(3),
    phone: "9876500000", purpose: "Bathroom leak repair",
  });
  push({
    id: "v_4", name: "Flipkart Delivery", category: "delivery", brand: "Flipkart", flatCode: "B-201", gateId: "gate_main",
    status: "waiting", raisedBy: "Guard · Mohan Singh", createdAt: minsAgo(9), purpose: "Package delivery",
  });
  push({
    id: "v_5", name: "Sunita Devi", category: "guest", flatCode: "C-105", gateId: "gate_main", status: "pending",
    raisedBy: "Guard · Mohan Singh", createdAt: minsAgo(12), phone: "9123456780", purpose: "Relative visiting",
  });
  push({
    id: "v_6", name: "CoolAir AC Service", category: "service", flatCode: "A-101", gateId: "gate_back", status: "waiting",
    raisedBy: "Guard · Ravi Yadav", createdAt: minsAgo(2), phone: "9000011111", purpose: "AC servicing",
  });
  push({
    id: "v_7", name: "Swiggy Delivery", category: "delivery", brand: "Swiggy", flatCode: "D-302", gateId: "gate_main",
    status: "inside", raisedBy: "QR self check-in", createdAt: minsAgo(31), approvedAt: minsAgo(31), entryAt: minsAgo(30),
    allowedMins: 15, passCode: code6(), purpose: "Food delivery",
  });
  push({
    id: "v_8", name: "Kiran Deshpande", category: "guest", flatCode: "A-401", gateId: "gate_main", status: "pre-approved",
    raisedBy: "Self", createdAt: hoursAgo(6), expectedAt: inDays(1), passCode: code6(), purpose: "Dinner",
  });

  // a day of history so the log and the guard leaderboard look real
  for (let i = 0; i < 26; i++) {
    const cat = pick(["delivery", "delivery", "guest", "service", "cab"]);
    const f = pick(flats);
    const t = int(30, 700);
    push({
      id: `v_h${i}`, name: cat === "delivery" ? `${pick(DELIVERY_BRANDS)} Delivery` : name(),
      category: cat, flatCode: f.code, gateId: pick(gates).id,
      status: chance(0.86) ? "exited" : "denied",
      raisedBy: chance(0.3) ? "Self" : `Guard · ${pick(["Mohan Singh", "Ravi Yadav", "Sunil Kamble"])}`,
      createdAt: minsAgo(t + 20), approvedAt: minsAgo(t + 18), entryAt: minsAgo(t + 17), exitAt: minsAgo(t),
      allowedMins: cat === "delivery" ? 20 : 240, verifiedBy: pick(["u_grd", "u_grd", "u_grd2", "u_grd3"]),
    });
  }

  const helpRoles = ["Maid", "Cook", "Driver", "Nanny", "Dog walker", "Newspaper", "Milkman"];
  const dailyHelp = [];
  for (let i = 0; i < 22; i++) {
    const inTime = chance(0.75);
    dailyHelp.push({
      id: `dh_${i}`, name: name(), role: pick(helpRoles), phone: phone(),
      flats: Array.from({ length: int(1, 4) }, () => pick(flats).code).filter((v, j, a) => a.indexOf(v) === j),
      cardCode: code6(), biometric: chance(0.7), verified: chance(0.85),
      policeVerified: chance(0.6), rating: Number((3.6 + rnd() * 1.4).toFixed(1)),
      status: inTime ? "in" : "out",
      lastIn: inTime ? minsAgo(int(20, 300)) : null,
      photo: null,
    });
  }
  // make sure the demo flat has help
  dailyHelp[0].flats = ["A-401", "A-402"]; dailyHelp[0].role = "Maid"; dailyHelp[0].status = "in"; dailyHelp[0].lastIn = minsAgo(65);
  dailyHelp[1].flats = ["A-401"]; dailyHelp[1].role = "Cook"; dailyHelp[1].status = "out";
  dailyHelp[2].flats = ["A-401", "B-201"]; dailyHelp[2].role = "Driver"; dailyHelp[2].status = "in"; dailyHelp[2].lastIn = minsAgo(140);

  const attendance = [];
  for (let d = 0; d < 7; d++) {
    for (const h of dailyHelp) {
      if (!chance(0.85)) continue;
      const base = new Date(Date.now() - d * 864e5);
      base.setHours(int(7, 10), int(0, 59), 0, 0);
      const out = new Date(base.getTime() + int(45, 200) * 60e3);
      attendance.push({
        id: `att_${h.id}_${d}`, helpId: h.id, date: dayKey(base), inAt: base.toISOString(),
        outAt: d === 0 && h.status === "in" ? null : out.toISOString(), mode: h.biometric ? "biometric" : "qr",
        gateId: pick(gates).id,
      });
    }
  }

  const checkpoints = [
    { id: "cp_1", name: "Block A Lobby", zone: "Block A", qr: "GVS-CP-01" },
    { id: "cp_2", name: "Block C Terrace", zone: "Block C", qr: "GVS-CP-02" },
    { id: "cp_3", name: "Basement Parking P1", zone: "Parking", qr: "GVS-CP-03" },
    { id: "cp_4", name: "STP / Pump Room", zone: "Utility", qr: "GVS-CP-04" },
    { id: "cp_5", name: "Children's Play Area", zone: "Open", qr: "GVS-CP-05" },
    { id: "cp_6", name: "Perimeter — East Wall", zone: "Perimeter", qr: "GVS-CP-06" },
  ];

  const patrols = [];
  for (let i = 0; i < 18; i++) {
    const cp = pick(checkpoints);
    patrols.push({
      id: `pt_${i}`, checkpointId: cp.id, guardId: pick(["u_grd", "u_grd2", "u_grd3"]),
      at: minsAgo(int(10, 900)), geo: { lat: 18.52 + rnd() / 500, lng: 73.85 + rnd() / 500 }, note: "",
    });
  }

  const incidents = [
    { id: "inc_1", type: "misbehaviour", severity: "high", by: "u_grd", at: hoursAgo(20), gateId: "gate_main",
      note: "Visitor refused to share ID and argued with guard. One-click recording captured.", recording: "REC-4821", status: "open", involves: "Visitor at Main Gate" },
    { id: "inc_2", type: "overstay", severity: "medium", by: "system", at: hoursAgo(5), gateId: "gate_main",
      note: "Delivery executive exceeded 20-minute in-building limit by 14 minutes.", status: "closed", involves: "Amazon Delivery · C-204" },
    { id: "inc_3", type: "safety", severity: "low", by: "u_grd3", at: daysAgo(2), gateId: "gate_club",
      note: "Basement P2 light not working — reported to facility manager.", status: "closed", involves: "Parking" },
  ];

  const gatePasses = [];
  return { gates, visitors, dailyHelp, attendance, checkpoints, patrols, incidents, gatePasses };
}

/* ---------------- community ---------------- */
function buildCommunity(flats) {
  const notices = [
    { id: "n_1", kind: "notice", title: "Water supply disruption — Thursday", body: "Water supply will be interrupted on Thursday from 10 AM to 2 PM for overhead tank cleaning. Please store water in advance. Tanker backup will be available at the service gate.", author: "u_adm", at: hoursAgo(20), priority: "high", pinned: true, reactions: { "👍": 12, "😟": 3 }, comments: [], readBy: ["u_com"] },
    { id: "n_2", kind: "event", title: "Ganesh Utsav 2026 — volunteers needed 🎉", body: "Cultural committee invites volunteers for decoration, prasad and cultural night. Meeting at the clubhouse this Saturday, 6 PM.", author: "u_com", at: daysAgo(1), priority: "normal", reactions: { "🎉": 24, "❤️": 8 }, comments: [{ id: "c1", by: "u_res", at: hoursAgo(18), text: "Count me in for decoration." }], readBy: [] },
    { id: "n_3", kind: "notice", title: "Revised parking guidelines", body: "Park only in your allotted slot. Visitor vehicles must use the visitor bay near the service gate. Repeat violations attract a ₹500 penalty billed to the flat.", author: "u_adm", at: daysAgo(3), priority: "normal", reactions: { "👍": 6 }, comments: [], readBy: [] },
    { id: "n_4", kind: "payment", title: "Maintenance bills for this cycle are out", body: "Bills have been issued to all flats. Kindly pay by the 10th to avoid 2% late fee. Payment reflects in the society account within 30 minutes of payment.", author: "u_com", at: daysAgo(5), priority: "high", reactions: { "👍": 15 }, comments: [], readBy: [] },
    { id: "n_5", kind: "notice", title: "AGM minutes uploaded", body: "Minutes of the Annual General Meeting held on 11/07 are now available in Documents → Meeting minutes.", author: "u_adm", at: daysAgo(9), priority: "normal", reactions: { "👍": 9 }, comments: [], readBy: [] },
  ];

  const polls = [
    { id: "p_1", question: "Should we install EV charging points in the basement?", options: [
        { id: "o1", text: "Yes — 4 points in P1", votes: 63 },
        { id: "o2", text: "Yes — but only 2 to start", votes: 41 },
        { id: "o3", text: "No — not yet", votes: 12 },
      ], closesAt: inDays(4), createdBy: "u_com", at: daysAgo(2), voters: {}, multi: false },
    { id: "p_2", question: "Preferred slot for the weekly deep-clean of the clubhouse?", options: [
        { id: "o1", text: "Monday 7–10 AM", votes: 18 },
        { id: "o2", text: "Wednesday 7–10 AM", votes: 24 },
        { id: "o3", text: "Sunday 7–10 AM", votes: 37 },
      ], closesAt: inDays(9), createdBy: "u_com", at: daysAgo(1), voters: {}, multi: false },
  ];

  const amenities = [
    { id: "am_1", name: "Clubhouse Hall", emoji: "🏛️", capacity: 120, charge: 2500, deposit: 5000, slots: ["09:00–13:00", "14:00–18:00", "19:00–23:00"], rules: "No loud music after 10 PM. Deposit refunded after inspection." },
    { id: "am_2", name: "Swimming Pool", emoji: "🏊", capacity: 25, charge: 0, deposit: 0, slots: ["06:00–08:00", "08:00–10:00", "17:00–19:00", "19:00–21:00"], rules: "Swim cap mandatory. Children under 10 need an adult." },
    { id: "am_3", name: "Gymnasium", emoji: "🏋️", capacity: 15, charge: 0, deposit: 0, slots: ["05:30–07:30", "07:30–09:30", "18:00–20:00", "20:00–22:00"], rules: "Wipe equipment after use." },
    { id: "am_4", name: "Badminton Court", emoji: "🏸", capacity: 4, charge: 150, deposit: 0, slots: ["06:00–07:00", "07:00–08:00", "18:00–19:00", "19:00–20:00", "20:00–21:00"], rules: "Non-marking shoes only." },
    { id: "am_5", name: "Party Lawn", emoji: "🌿", capacity: 80, charge: 4000, deposit: 8000, slots: ["11:00–15:00", "18:00–23:00"], rules: "Catering vendors need a gate pass 24h in advance." },
    { id: "am_6", name: "Co-working Room", emoji: "💻", capacity: 8, charge: 100, deposit: 0, slots: ["09:00–13:00", "14:00–18:00"], rules: "Silence zone. Calls in the booth only." },
  ];

  const classes = [
    { id: "cl_1", name: "Yoga — morning batch", emoji: "🧘", trainer: "Asha Menon", days: "Mon / Wed / Fri", time: "06:30 – 07:30", fee: 800, seats: 20, enrolled: 14, amenityId: "am_1" },
    { id: "cl_2", name: "Kids Karate", emoji: "🥋", trainer: "Sensei Rakesh", days: "Tue / Thu", time: "17:30 – 18:30", fee: 1200, seats: 24, enrolled: 21, amenityId: "am_1" },
    { id: "cl_3", name: "Zumba", emoji: "💃", trainer: "Nidhi Kapoor", days: "Sat / Sun", time: "08:00 – 09:00", fee: 900, seats: 25, enrolled: 9, amenityId: "am_1" },
    { id: "cl_4", name: "Swimming coaching", emoji: "🏊", trainer: "Coach Vinod", days: "Mon – Fri", time: "16:00 – 17:00", fee: 1800, seats: 12, enrolled: 12, amenityId: "am_2" },
  ];

  const bookings = [
    { id: "bk_1", amenityId: "am_1", userId: "u_res", flatCode: "A-401", date: dayKey(new Date(Date.now() + 4 * 864e5)), slot: "19:00–23:00", status: "confirmed", amount: 2500, guests: 60, note: "Birthday party" },
    { id: "bk_2", amenityId: "am_4", userId: "u_res", flatCode: "A-401", date: dayKey(new Date(Date.now() + 1 * 864e5)), slot: "19:00–20:00", status: "confirmed", amount: 150, guests: 4, note: "" },
    { id: "bk_3", amenityId: "am_5", userId: "u_com", flatCode: "B-201", date: dayKey(new Date(Date.now() + 6 * 864e5)), slot: "18:00–23:00", status: "pending", amount: 4000, guests: 75, note: "Anniversary" },
  ];

  const tickets = [
    { id: "tk_1", ref: "HD-2041", category: "Plumbing", title: "Water seepage in bathroom ceiling", body: "Seepage from the flat above has started staining the false ceiling. Needs urgent inspection.", raisedBy: "u_res", flatCode: "A-401", status: "in-progress", priority: "high", assignedTo: "u_stf3", at: hoursAgo(30), slaDueAt: inMins(180), source: "app", comments: [{ id: "tc1", by: "u_stf3", at: hoursAgo(20), text: "Visited the flat above; their bathroom drain is choked. Will fix tomorrow morning." }], rating: null },
    { id: "tk_2", ref: "HD-2042", category: "Electrical", title: "Corridor light not working — A wing 4th floor", body: "Two tube lights out since Monday.", raisedBy: "u_res2", flatCode: "A-401", status: "open", priority: "medium", assignedTo: null, at: hoursAgo(6), slaDueAt: inMins(1200), source: "ai-call", comments: [], rating: null },
    { id: "tk_3", ref: "HD-2039", category: "Housekeeping", title: "Garbage not collected from 3rd floor", body: "Wet waste bins not cleared yesterday.", raisedBy: "u_com", flatCode: "B-201", status: "resolved", priority: "low", assignedTo: "u_stf", at: daysAgo(3), slaDueAt: daysAgo(2), resolvedAt: daysAgo(2), source: "app", comments: [{ id: "tc2", by: "u_stf", at: daysAgo(2), text: "Housekeeping supervisor briefed. Collection restored." }], rating: 4 },
    { id: "tk_4", ref: "HD-2044", category: "Security", title: "Basement P2 CCTV camera angle changed", body: "Camera near slot 42 is pointing at the wall.", raisedBy: "u_adm", flatCode: "A-101", status: "open", priority: "high", assignedTo: "u_stf2", at: hoursAgo(2), slaDueAt: inMins(-45), source: "app", comments: [], rating: null },
  ];

  const forum = [
    { id: "fp_1", type: "discussion", title: "Anyone else facing low water pressure in E block?", body: "Since the pump servicing, 5th and 6th floor taps are weak in the mornings.", by: "u_E-503", at: hoursAgo(9), likes: 7, comments: [{ id: "fc1", by: "u_stf", at: hoursAgo(7), text: "Booster pump valve is being re-set today. Should normalise by evening." }] },
    { id: "fp_2", type: "classified", title: "Godrej 3-door wardrobe — ₹8,000", body: "3 years old, excellent condition. Moving out, need to sell this week.", by: "u_C-402", at: daysAgo(1), price: 8000, likes: 3, comments: [] },
    { id: "fp_3", type: "recommendation", title: "Reliable maths tutor for class 9?", body: "Looking for someone who can come home twice a week.", by: "u_B-105", at: daysAgo(2), likes: 5, comments: [{ id: "fc2", by: "u_res", at: daysAgo(1), text: "Mr. Kulkarni from D wing tutors my son. Very good." }] },
    { id: "fp_4", type: "classified", title: "Bicycle (kids, 20 inch) — free to a good home", body: "My daughter has outgrown it. First come first served.", by: "u_A-205", at: daysAgo(4), price: 0, likes: 11, comments: [] },
  ];

  const services = [
    { id: "sv_1", name: "Home painting", emoji: "🎨", desc: "1BHK–4BHK, 5-year warranty on premium emulsion", from: 12999, rating: 4.6, jobs: 320 },
    { id: "sv_2", name: "Packers & movers", emoji: "🚚", desc: "Intra-city and inter-city, insured transit", from: 4999, rating: 4.4, jobs: 210 },
    { id: "sv_3", name: "Deep cleaning", emoji: "🧽", desc: "Kitchen, bathroom and full-home deep clean", from: 2499, rating: 4.7, jobs: 540 },
    { id: "sv_4", name: "AC service & repair", emoji: "❄️", desc: "Jet service, gas refill, installation", from: 549, rating: 4.5, jobs: 780 },
    { id: "sv_5", name: "Electrician & plumber", emoji: "🔧", desc: "On-demand visits, 60-minute response in society", from: 299, rating: 4.3, jobs: 1120 },
    { id: "sv_6", name: "Pest control", emoji: "🐜", desc: "Cockroach, termite and general disinfection", from: 1299, rating: 4.5, jobs: 260 },
  ];

  const documents = [
    { id: "doc_1", name: "AGM Minutes — 11 Jul 2026.pdf", category: "Meeting minutes", size: "412 KB", by: "u_adm", at: daysAgo(9) },
    { id: "doc_2", name: "Society Bye-laws (registered).pdf", category: "Legal", size: "1.8 MB", by: "u_adm", at: daysAgo(210) },
    { id: "doc_3", name: "Audited Financials FY 2025-26.pdf", category: "Accounts", size: "980 KB", by: "u_com", at: daysAgo(60) },
    { id: "doc_4", name: "Fire NOC — valid till Mar 2027.pdf", category: "Compliance", size: "220 KB", by: "u_adm", at: daysAgo(150) },
    { id: "doc_5", name: "Lift AMC contract — Otis.pdf", category: "Contracts", size: "640 KB", by: "u_stf", at: daysAgo(95) },
    { id: "doc_6", name: "Parking allotment list.xlsx", category: "Facilities", size: "72 KB", by: "u_stf", at: daysAgo(30) },
  ];

  const vehicles = [
    { id: "veh_1", ownerId: "u_res", flatCode: "A-401", kind: "Car", model: "Hyundai Creta", number: "MH-12-AB-1234", slot: "P1-42", sticker: "GVS-0421" },
    { id: "veh_2", ownerId: "u_res", flatCode: "A-401", kind: "Bike", model: "Honda Activa", number: "MH-12-CD-5678", slot: "B-15", sticker: "GVS-0422" },
    { id: "veh_3", ownerId: "u_com", flatCode: "B-201", kind: "Car", model: "Tata Nexon EV", number: "MH-12-EF-9012", slot: "P1-08", sticker: "GVS-0311" },
  ];

  const emergencyContacts = [
    { id: "ec_1", name: "Society Security Desk", phone: "020-40001234", tag: "24x7" },
    { id: "ec_2", name: "Facility Manager — Ganesh Rane", phone: "9822011223", tag: "Manager" },
    { id: "ec_3", name: "Ambulance (Sahyadri)", phone: "1066", tag: "Medical" },
    { id: "ec_4", name: "Fire Brigade", phone: "101", tag: "Fire" },
    { id: "ec_5", name: "Police Control Room", phone: "100", tag: "Police" },
    { id: "ec_6", name: "Lift Emergency — Otis", phone: "1800-1023-999", tag: "Lift" },
  ];

  return { notices, polls, amenities, classes, bookings, tickets, forum, services, documents, vehicles, emergencyContacts };
}

/* ---------------- root ---------------- */
export function buildSeed() {
  _s = 987654321;
  const { flats, users } = buildPeople();
  const finance = buildFinance(flats);
  const gate = buildGate(flats);
  const community = buildCommunity(flats);

  const registrations = [
    { id: "reg_1", name: "Priya Sharma", flatCode: "B-302", relation: "owner", phone: "9876543210", email: "priya.new@email.com", status: "pending", at: hoursAgo(10), docs: ["Sale deed", "Aadhaar"] },
    { id: "reg_2", name: "Amit Patel", flatCode: "C-105", relation: "tenant", phone: "9876543211", email: "amit.new@email.com", status: "pending", at: daysAgo(1), docs: ["Rent agreement", "Police verification"] },
    { id: "reg_3", name: "Sneha Kulkarni", flatCode: "D-204", relation: "co-owner", phone: "9876543212", email: "sneha.new@email.com", status: "pending", at: daysAgo(2), docs: ["Aadhaar"] },
  ];

  return {
    version: 4,
    settings: {
      societyName: "Green Valley Society",
      accent: "indigo",
      address: "Baner Road, Pune 411045",
      regNo: "PNA/GNL/(O)/HSG/(TC)/9214/2011",
      blocks: BLOCKS,
      flatCount: flats.length,
      finYear: "2026-27",
      lateFeePct: 2,
      gracePeriodDays: 0,
      overstayMins: 20,
      settlementMins: 30,
      slaHours: { high: 4, medium: 24, low: 72 },
      gstin: "27AABCG1234M1Z5",
      bank: { name: "HDFC Bank — Baner", account: "50200012345678", ifsc: "HDFC0000123" },
      features: { biometric: true, qrSelfCheckin: true, walkieTalkie: true, overstayAlarm: true, smartwatch: true, aiHelpdesk: true },
    },
    users, flats, registrations,
    ...finance,
    ...gate,
    ...community,
    settlements: [],
    bankStatements: [],
    audit: [
      { id: "au_0", at: daysAgo(5), actor: "u_com", action: "billing.approve", entity: `Billing run ${finance.cycles.at(-1)}`, detail: "Maker-checker approval — 150 bills issued" },
      { id: "au_1", at: daysAgo(9), actor: "u_adm", action: "document.upload", entity: "AGM Minutes — 11 Jul 2026.pdf", detail: "Uploaded to Meeting minutes" },
    ],
    sos: [],
    announcementsRead: [],
  };
}

/**
 * The same shape as the seed, with nothing in it.
 *
 * A real society must never be shown another society's data. The screens that
 * have no endpoint yet read this store, and seeding it meant a brand-new
 * society opened onto Green Valley's notices, its ledger, and — worse — its
 * residents by name and flat number. Empty is the honest state: those screens
 * show their empty case until each one is migrated.
 *
 * Derived from the seed rather than listed by hand, so a collection added to
 * the seed later cannot be forgotten here and leak.
 */
export function emptyStore() {
  const seeded = buildSeed();
  const out = { version: seeded.version, settings: seeded.settings };
  for (const [key, value] of Object.entries(seeded)) {
    if (key === "version" || key === "settings") continue;
    out[key] = Array.isArray(value) ? [] : value && typeof value === "object" ? {} : value;
  }
  /* The society's own name, address and rules arrive from the server and
     replace these; the rest are neutral defaults rather than Green Valley's. */
  out.settings = {
    ...seeded.settings,
    societyName: "", address: "", regNo: "", gstin: "", flatCount: 0, blocks: [],
    bank: { name: "", account: "", ifsc: "" },
  };
  return out;
}

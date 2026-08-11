/**
 * Bill calculation.
 *
 * This runs on the server when a bill is actually created. The web app calls it
 * only to preview what a run will look like — the number a resident is charged
 * is always the one the API computed.
 */

export const CHARGE_BASES = ["per_sqft", "flat", "per_slot", "tenant_only"];

export const DEFAULT_HEADS = [
  { id: "h_maint", name: "Maintenance charges", basis: "per_sqft", rate: 3.2, gst: 0 },
  { id: "h_water", name: "Water charges", basis: "flat", rate: 320, gst: 0 },
  { id: "h_sink", name: "Sinking fund", basis: "flat", rate: 450, gst: 0 },
  { id: "h_repair", name: "Repair fund", basis: "flat", rate: 300, gst: 0 },
  { id: "h_park", name: "Parking charges", basis: "per_slot", rate: 200, gst: 0 },
  { id: "h_club", name: "Clubhouse & amenities", basis: "flat", rate: 250, gst: 18 },
  { id: "h_ngc", name: "Non-occupancy charges", basis: "tenant_only", rate: 400, gst: 0 },
];

/** Amount for a single head before GST. Returns 0 when the head does not apply. */
export function headAmount(head, flat, parkingSlots) {
  switch (head.basis) {
    case "per_sqft": return Math.round(Number(flat.area || 0) * head.rate);
    case "flat": return head.rate;
    case "per_slot": return head.rate * Number(parkingSlots || 0);
    case "tenant_only": return flat.occupancy === "tenant" ? head.rate : 0;
    default: return 0;
  }
}

/**
 * @param {{area:number, occupancy:string, type?:string}} flat
 * @param {Array} heads charge heads for the society
 * @param {number} parkingSlots slots allotted to this flat
 */
export function computeBill(flat, heads = DEFAULT_HEADS, parkingSlots = 0) {
  const items = [];
  for (const head of heads) {
    const amount = headAmount(head, flat, parkingSlots);
    if (!amount) continue;
    items.push({
      headId: head.id,
      name: head.name,
      amount,
      gst: Math.round((amount * (head.gst || 0)) / 100),
    });
  }
  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const gst = items.reduce((s, i) => s + i.gst, 0);
  return { items, subtotal, gst, total: subtotal + gst };
}

export function lateFeeFor(total, lateFeePct) {
  return Math.round((Number(total) * Number(lateFeePct || 0)) / 100);
}

/** True once the bill is past its due date plus any grace period. */
export function isOverdue(bill, gracePeriodDays = 0, now = new Date()) {
  if (bill.status === "paid") return false;
  const due = new Date(bill.dueDate);
  due.setDate(due.getDate() + Number(gracePeriodDays || 0));
  return now > due;
}

/** Bank narration carrying the flat number, so credits reconcile without guesswork. */
export function narrationFor({ mode, societyCode = "GVS", flatCode, cycle }) {
  return `${String(mode).toUpperCase()}/CR/${societyCode}/${flatCode}/${String(cycle).replace("-", "")}`;
}

export function receiptNoFor({ cycle, flatCode }) {
  return `RCT-${String(cycle).replace("-", "")}-${flatCode}`;
}

export function settlementDueAt(paidAt, settlementMins) {
  return new Date(new Date(paidAt).getTime() + Number(settlementMins) * 60_000);
}

export function slaDueAt(priority, slaHours, from = new Date()) {
  const hours = slaHours?.[priority] ?? 24;
  return new Date(new Date(from).getTime() + hours * 3_600_000);
}

/** YYYY-MM helpers — billing cycles are month-granular throughout. */
export function shiftCycle(cycle, n) {
  const [y, m] = String(cycle).split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function currentCycle(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

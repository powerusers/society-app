/** DB rows are snake_case; the API speaks the camelCase the clients already use. */

export const publicUser = (u) => u && ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  role: u.role,
  designation: u.designation,
  relation: u.relation,
  flat: u.flat_code ?? null,
  flatId: u.flat_id ?? null,
  gateId: u.gate_id ?? null,
  shift: u.shift ?? null,
  status: u.status,
  notify: u.notify,
  joined: u.created_at,
});

/** Directory listing: phone is masked unless the viewer is allowed to see it. */
export const directoryUser = (u, revealContact) => ({
  id: u.id,
  name: u.name,
  flat: u.flat_code ?? null,
  relation: u.relation,
  role: u.role,
  designation: u.designation,
  joined: u.created_at,
  phone: revealContact ? u.phone : maskPhone(u.phone),
  /* Stated rather than inferred. Without it the client has to guess from the
     bullet characters whether a number is real, and a wrong guess either hides
     a number the resident chose to share or offers to dial a masked one. */
  contactHidden: !revealContact,
  /* An address is as identifying as a number, so it is withheld under the same
     consent rather than masked into something half-readable. */
  email: revealContact ? u.email : null,
});

export const maskPhone = (p) => (p && p.length >= 4 ? `${p.slice(0, 2)}••••${p.slice(-2)}` : "");

export const flat = (f) => ({
  id: f.id,
  code: f.code,
  block: f.block,
  floor: f.floor,
  type: f.type,
  area: f.area,
  occupancy: f.occupancy,
  parkingSlots: f.parking_slots,
});

export const visitor = (v) => ({
  id: v.id,
  name: v.name,
  category: v.category,
  status: v.status,
  flatCode: v.flat_code ?? null,
  gateId: v.gate_id,
  gateName: v.gate_name ?? null,
  purpose: v.purpose,
  phone: v.phone,
  vehicle: v.vehicle,
  passCode: v.pass_code,
  allowedMins: v.allowed_mins,
  recurring: v.recurring,
  expectedAt: v.expected_at,
  raisedBy: v.raised_by,
  denyReason: v.deny_reason,
  sentAt: v.sent_at,
  approvedAt: v.approved_at,
  entryAt: v.entry_at,
  exitAt: v.exit_at,
  createdAt: v.created_at,
});

export const bill = (b) => ({
  id: b.id,
  cycle: b.cycle,
  flatCode: b.flat_code ?? null,
  items: b.items,
  subtotal: b.subtotal,
  gst: b.gst,
  lateFee: b.late_fee,
  total: b.total,
  dueDate: b.due_date,
  status: b.status,
  makerId: b.maker_id,
  approvedBy: b.approved_by,
  approvedAt: b.approved_at,
  issuedAt: b.issued_at,
  paidAt: b.paid_at,
});

export const payment = (p) => ({
  id: p.id,
  billId: p.bill_id,
  flatCode: p.flat_code ?? null,
  amount: p.amount,
  mode: p.mode,
  txnId: p.txn_id,
  receiptNo: p.receipt_no,
  narration: p.narration,
  paidAt: p.paid_at,
  settledAt: p.settled_at,
  reconciled: p.reconciled,
  reconciledAt: p.reconciled_at,
});

export const ticket = (t) => ({
  id: t.id,
  ref: t.ref,
  title: t.title,
  body: t.body,
  category: t.category,
  priority: t.priority,
  status: t.status,
  source: t.source,
  flatCode: t.flat_code ?? null,
  raisedBy: t.raised_by,
  raisedByName: t.raised_by_name ?? null,
  assignedTo: t.assigned_to,
  assignedToName: t.assigned_to_name ?? null,
  slaDueAt: t.sla_due_at,
  resolvedAt: t.resolved_at,
  rating: t.rating,
  at: t.created_at,
  comments: t.comments ?? undefined,
});

export const comment = (c) => ({
  id: c.id,
  by: c.author_id,
  byName: c.author_name ?? null,
  text: c.text,
  at: c.created_at,
});

export const auditRow = (a) => ({
  id: String(a.id),
  actor: a.actor_id,
  actorName: a.actor_name ?? null,
  action: a.action,
  entity: a.entity,
  entityId: a.entity_id,
  detail: a.detail,
  at: a.created_at,
});

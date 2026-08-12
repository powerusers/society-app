/** Shared vocabulary: the values both sides are allowed to store and send. */

export const VISITOR_CATEGORIES = ["delivery", "guest", "service", "cab", "staff"];

/**
 * Gate lifecycle. The API rejects any transition not listed here, so a stale
 * client cannot, say, admit a visitor the resident already denied.
 */
export const VISITOR_STATUSES = ["waiting", "pending", "approved", "pre-approved", "inside", "exited", "denied"];

export const VISITOR_TRANSITIONS = {
  waiting: ["pending", "denied"],
  pending: ["approved", "denied"],
  approved: ["inside", "denied"],
  "pre-approved": ["inside", "denied"],
  inside: ["exited"],
  exited: [],
  denied: [],
};

export function canTransitionVisitor(from, to) {
  return (VISITOR_TRANSITIONS[from] || []).includes(to);
}

export const TICKET_STATUSES = ["open", "in-progress", "resolved", "closed"];
export const TICKET_PRIORITIES = ["high", "medium", "low"];
export const TICKET_CATEGORIES = [
  "Plumbing", "Electrical", "Housekeeping", "Security", "Lift", "Parking", "Common area", "Billing", "Other",
];
export const TICKET_SOURCES = ["app", "ai-call", "walk-in"];

export const BILL_STATUSES = ["pending-approval", "issued", "overdue", "paid"];

export const BILL_TRANSITIONS = {
  "pending-approval": ["issued"],
  issued: ["paid", "overdue"],
  overdue: ["paid"],
  paid: [],
};

export function canTransitionBill(from, to) {
  return (BILL_TRANSITIONS[from] || []).includes(to);
}

export const PAYMENT_MODES = ["UPI", "NetBanking", "Card", "NEFT", "RTGS", "Cheque", "Cash"];

export const RELATIONS = ["owner", "co-owner", "tenant"];

export const NOTICE_KINDS = ["notice", "event", "payment", "alert"];

/* The residents' own board, as opposed to the committee's. A classified carries
   a price; the other two do not. */
export const POST_TYPES = ["discussion", "recommendation", "classified"];

export const INCIDENT_TYPES = ["misbehaviour", "trespass", "safety", "vehicle", "overstay", "other"];
export const SEVERITIES = ["high", "medium", "low"];

export const DEFAULT_SETTINGS = {
  lateFeePct: 2,
  gracePeriodDays: 0,
  overstayMins: 20,
  settlementMins: 30,
  slaHours: { high: 4, medium: 24, low: 72 },
};

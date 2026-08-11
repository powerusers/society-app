import { z } from "zod";
import {
  VISITOR_CATEGORIES, VISITOR_STATUSES, TICKET_CATEGORIES, TICKET_PRIORITIES,
  TICKET_STATUSES, TICKET_SOURCES, PAYMENT_MODES, RELATIONS,
  INCIDENT_TYPES, SEVERITIES,
} from "./entities.js";
import {
  DOCUMENT_CATEGORIES, DOCUMENT_VISIBILITY, MAX_DOCUMENT_BYTES, isAllowedContentType,
} from "./documents.js";

/** Request payload schemas. The API validates with these; forms reuse them for client-side checks. */

/* Deliberately loose. Three digits is one society's numbering, not a rule —
   a tenth-floor flat is 1003 in most towers, and blocks are sometimes two
   letters. The authority on whether a flat exists is the society's register,
   which the API checks and reports precisely; a format rule any tighter than
   this rejects real flats before that check can run.
   The message names the field the user is actually typing in, since the form
   collects the block separately and cannot accept "A-401" in that box. */
const flatCode = z.string().regex(
  /^[A-Z]{1,2}-\d{1,4}[A-Z]?$/,
  "Flat number should be 1–4 digits, like 401 or 1003",
);
const phone = z.string().regex(/^\d{10}$/, "Enter a 10-digit mobile number");
const cycle = z.string().regex(/^\d{4}-\d{2}$/, "Cycle looks like 2026-08");

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export const registrationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  flatCode,
  relation: z.enum(RELATIONS),
  phone,
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const createVisitorSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.enum(VISITOR_CATEGORIES),
  flatCode,
  gateId: z.string().uuid("Unknown gate").optional(),
  purpose: z.string().max(240).optional().default(""),
  phone: z.string().max(15).optional().default(""),
  vehicle: z.string().max(20).optional().default(""),
  /** Guards create `waiting` entries; residents create `pre-approved` passes. */
  status: z.enum(["waiting", "pre-approved"]).default("waiting"),
  expectedAt: z.string().datetime().optional(),
  recurring: z.enum(["once", "daily", "weekdays", "weekly"]).default("once"),
  allowedMins: z.number().int().positive().max(1440).optional(),
});

export const transitionVisitorSchema = z.object({
  status: z.enum(VISITOR_STATUSES),
  reason: z.string().max(240).optional(),
  allowedMins: z.number().int().positive().max(1440).optional(),
});

export const verifyPassSchema = z.object({
  passCode: z.string().trim().length(6),
});

export const createTicketSchema = z.object({
  title: z.string().trim().min(3).max(160),
  body: z.string().max(2000).optional().default(""),
  category: z.enum(TICKET_CATEGORIES),
  priority: z.enum(TICKET_PRIORITIES).default("medium"),
  flatCode: flatCode.optional(),
  source: z.enum(TICKET_SOURCES).default("app"),
});

export const updateTicketSchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
}).refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const ticketCommentSchema = z.object({
  text: z.string().trim().min(1).max(2000),
});

export const rateTicketSchema = z.object({
  rating: z.number().int().min(1).max(5),
});

export const generateRunSchema = z.object({
  cycle,
});

export const payBillSchema = z.object({
  mode: z.enum(PAYMENT_MODES).default("UPI"),
});

export const createIncidentSchema = z.object({
  type: z.enum(INCIDENT_TYPES),
  severity: z.enum(SEVERITIES).default("medium"),
  involves: z.string().trim().min(1).max(200),
  note: z.string().max(2000).optional().default(""),
  gateId: z.string().optional(),
});

export const requestUploadSchema = z.object({
  name: z.string().trim().min(1).max(160),
  fileName: z.string().trim().min(1).max(200),
  category: z.enum(DOCUMENT_CATEGORIES),
  visibility: z.enum(DOCUMENT_VISIBILITY).default("residents"),
  contentType: z.string().refine(isAllowedContentType, "That file type is not accepted"),
  /** Declared up front so an oversized file is refused before a byte is uploaded. */
  sizeBytes: z.number().int().positive().max(MAX_DOCUMENT_BYTES, "File is larger than the 25 MB limit"),
});

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.string().optional(),
  flatCode: z.string().optional(),
  cycle: z.string().optional(),
  category: z.string().optional(),
});

/** Flattens a ZodError into `{ field: message }` for form display. */
export function fieldErrors(error) {
  const out = {};
  for (const issue of error.issues) out[issue.path.join(".") || "_"] = issue.message;
  return out;
}

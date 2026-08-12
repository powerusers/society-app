import { AppError } from "../lib/errors.js";
import { config } from "../config.js";

/** Maps Postgres integrity violations onto honest HTTP answers. */
function fromPgError(err) {
  switch (err.code) {
    case "23505": // unique_violation
      if (err.constraint === "bills_flat_id_cycle_key") return new AppError(409, "conflict", "A bill already exists for that flat and cycle");
      if (err.constraint === "payments_bill_id_key") return new AppError(409, "conflict", "This bill has already been paid");
      if (err.constraint === "users_society_id_email_key") return new AppError(409, "conflict", "That email is already registered");
      if (err.constraint === "visitors_active_pass_idx") return new AppError(409, "conflict", "That pass code is already in use");
      /* Two residents tapping the same slot in the same second: one of them
         arrives here, and gets told rather than being shown a booking that
         does not exist. */
      if (err.constraint === "amenity_slot_once") return new AppError(409, "conflict", "That slot has just been booked by another resident");
      return new AppError(409, "conflict", "That record already exists");
    case "23514": // check_violation
      if (err.constraint === "bills_maker_is_not_checker") {
        return new AppError(403, "forbidden", "The officer who prepared a run cannot approve it");
      }
      return new AppError(422, "unprocessable", "That value is not allowed");
    case "23503": // foreign_key_violation
      return new AppError(422, "unprocessable", "A referenced record does not exist");
    default:
      return null;
  }
}

export function errorHandler(err, req, res, _next) {
  const mapped = err instanceof AppError ? err : fromPgError(err);

  if (mapped) {
    return res.status(mapped.status).json({
      error: { code: mapped.code, message: mapped.message, ...(mapped.details ? { details: mapped.details } : {}) },
    });
  }

  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: { code: "bad_request", message: "Request body is not valid JSON" } });
  }

  console.error(`[api] unhandled ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({
    error: {
      code: "internal_error",
      message: "Something went wrong on our side",
      // stack only outside production; leaking internals to residents helps nobody
      ...(config.isProd ? {} : { debug: err?.message, stack: err?.stack?.split("\n").slice(0, 4) }),
    },
  });
}

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: { code: "not_found", message: "No such endpoint" } });
}

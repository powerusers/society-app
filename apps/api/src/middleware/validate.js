import { fieldErrors } from "@gvs/shared";
import { unprocessable } from "../lib/errors.js";

/** Replaces req.body with the parsed, defaulted result — so handlers never see raw input. */
export const validate = (schema) => (req, _res, next) => {
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) return next(unprocessable("Check the highlighted fields", fieldErrors(parsed.error)));
  req.body = parsed.data;
  next();
};

export const validateQuery = (schema) => (req, _res, next) => {
  const parsed = schema.safeParse(req.query ?? {});
  if (!parsed.success) return next(unprocessable("Invalid query parameters", fieldErrors(parsed.error)));
  // Express 5 exposes req.query as a getter, so stash the parsed copy alongside it.
  req.validQuery = parsed.data;
  next();
};

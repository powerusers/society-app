import { can } from "@gvs/shared";
import { one } from "../db/pool.js";
import { verifyAccessToken } from "../lib/tokens.js";
import { forbidden, unauthorized, wrap } from "../lib/errors.js";

/**
 * Resolves the bearer token to a live user row.
 *
 * The user is re-read on every request rather than trusted from the token, so
 * suspending an account or changing a role takes effect at once instead of
 * whenever the access token happens to expire.
 */
export const requireAuth = wrap(async (req, _res, next) => {
  const header = req.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) throw unauthorized();

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    throw unauthorized(err.name === "TokenExpiredError" ? "Session expired" : "Invalid token");
  }

  const user = await one(
    `SELECT u.*, f.code AS flat_code
       FROM users u LEFT JOIN flats f ON f.id = u.flat_id
      WHERE u.id = $1`,
    [payload.sub],
  );
  if (!user) throw unauthorized("Account no longer exists");
  if (user.status !== "active") throw forbidden("This account is suspended");

  /* The shared capability helpers read `user.flat`; the DB column is flat_code.
     Normalising here keeps one field name across the API and the web app. */
  user.flat = user.flat_code ?? null;
  req.user = user;
  next();
});

/**
 * Gate a route on a capability from the shared matrix.
 * This is the authorization check that actually matters — the web app's copy
 * only decides what to draw.
 */
export const requireCap = (capability) => (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  if (!can(req.user.role, capability)) {
    return next(forbidden(`Your role (${req.user.role}) cannot perform this action`, { capability }));
  }
  next();
};

/** Attaches the caller's society scope; every query filters on it. */
export const scoped = (req) => req.user.society_id;

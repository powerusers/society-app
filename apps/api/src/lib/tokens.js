import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { one, query } from "../db/pool.js";

/**
 * Short-lived access token in the Authorization header, long-lived refresh
 * token stored as a hash. Role and society travel in the token, but every
 * request re-reads the user so a suspended account or a role change takes
 * effect immediately rather than at token expiry.
 */
export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, sid: user.society_id },
    config.jwtSecret,
    { expiresIn: config.accessTtl, issuer: "gvs-api" },
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, config.jwtSecret, { issuer: "gvs-api" });
}

const hashToken = (t) => createHash("sha256").update(t).digest("hex");

export async function issueRefreshToken(userId) {
  const token = randomBytes(48).toString("base64url");
  const expiresAt = new Date(Date.now() + config.refreshTtlDays * 864e5);
  await query(
    "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    [userId, hashToken(token), expiresAt],
  );
  return { token, expiresAt };
}

export async function consumeRefreshToken(token) {
  const row = await one(
    `SELECT * FROM refresh_tokens
      WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()`,
    [hashToken(token)],
  );
  if (!row) return null;
  // Rotate on use: a replayed refresh token is already revoked and fails.
  await query("UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1", [row.id]);
  return row;
}

export async function revokeAllForUser(userId) {
  await query("UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [userId]);
}

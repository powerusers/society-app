import { createHash, randomInt } from "node:crypto";
import { generateInviteCode, normaliseInviteCode, INVITE_DEFAULT_DAYS } from "@gvs/shared";
import { many, one } from "../db/pool.js";

/**
 * Codes are high-entropy random strings, so a plain SHA-256 is enough to make
 * the stored value useless on its own — there is no dictionary to run against
 * 59 bits. A slow KDF would be the right choice for a human-chosen secret;
 * here it would only stop us looking the code up by value.
 */
export const hashInviteCode = (code) =>
  createHash("sha256").update(normaliseInviteCode(code)).digest("hex");

export const newInviteCode = () => generateInviteCode((max) => randomInt(max));

export async function createInvite({ label = "", societyName = null, email = null, days = INVITE_DEFAULT_DAYS }) {
  const code = newInviteCode();
  const row = await one(
    `INSERT INTO society_invites (code_hash, label, society_name, email, expires_at)
     VALUES ($1,$2,$3,$4, now() + ($5 || ' days')::interval)
     RETURNING id, label, society_name, email, expires_at, created_at`,
    [hashInviteCode(code), label, societyName, email, String(days)],
  );
  /* Returned once and never again — only the hash is stored. */
  return { ...row, code };
}

export const listInvites = () => many(
  `SELECT i.id, i.label, i.society_name, i.email, i.expires_at, i.used_at, i.revoked_at,
          s.name AS used_by_name,
          CASE
            WHEN i.revoked_at IS NOT NULL THEN 'revoked'
            WHEN i.used_at   IS NOT NULL THEN 'used'
            WHEN i.expires_at < now()    THEN 'expired'
            ELSE 'open'
          END AS status
     FROM society_invites i LEFT JOIN societies s ON s.id = i.used_by
    ORDER BY i.created_at DESC LIMIT 200`,
);

export const revokeInvite = (id) => one(
  `UPDATE society_invites SET revoked_at = now()
    WHERE id = $1 AND used_at IS NULL AND revoked_at IS NULL
    RETURNING id`,
  [id],
);

/**
 * Claims a code inside the caller's transaction.
 *
 * The row is locked before it is checked, so two requests racing the same code
 * cannot both find it unused — the second waits, then sees `used_at` set. The
 * `used_by` backfill happens after the society exists, in the same transaction,
 * so a failed setup rolls the redemption back with it.
 *
 * @returns {{ok: true, invite: object} | {ok: false, reason: string}}
 */
export async function claimInvite(client, rawCode, { societyName, email }) {
  const { rows } = await client.query(
    "SELECT * FROM society_invites WHERE code_hash = $1 FOR UPDATE",
    [hashInviteCode(rawCode)],
  );
  const invite = rows[0];
  if (!invite) return { ok: false, reason: "That invite code is not valid." };
  if (invite.revoked_at) return { ok: false, reason: "That invite code has been revoked." };
  if (invite.used_at) return { ok: false, reason: "That invite code has already been used." };
  if (new Date(invite.expires_at) < new Date()) return { ok: false, reason: "That invite code has expired." };

  /* Pins are what make a code specific rather than a second master key. */
  if (invite.society_name && invite.society_name.toLowerCase() !== String(societyName).toLowerCase()) {
    return { ok: false, reason: `This code was issued for "${invite.society_name}".` };
  }
  if (invite.email && String(invite.email).toLowerCase() !== String(email).toLowerCase()) {
    return { ok: false, reason: `This code was issued for a different email address.` };
  }

  await client.query("UPDATE society_invites SET used_at = now() WHERE id = $1", [invite.id]);
  return { ok: true, invite };
}

export const attachInviteToSociety = (client, inviteId, societyId) =>
  client.query("UPDATE society_invites SET used_by = $1 WHERE id = $2", [societyId, inviteId]);

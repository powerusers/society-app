import { Router } from "express";
import rateLimit from "express-rate-limit";
import { loginSchema, refreshSchema, registrationSchema } from "@gvs/shared";
import { one, query, tx } from "../db/pool.js";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { signAccessToken, issueRefreshToken, consumeRefreshToken, revokeAllForUser } from "../lib/tokens.js";
import { audit, auditCtx } from "../lib/audit.js";
import { publicUser } from "../lib/serialize.js";
import { unauthorized, conflict, wrap, notFound } from "../lib/errors.js";

export const authRouter = Router();

/* Credential stuffing protection. Keyed by IP + email so one attacker cannot
   lock out a whole building by hammering a shared NAT address. */
const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${String(req.body?.email || "").toLowerCase()}`,
  message: { error: { code: "rate_limited", message: "Too many attempts. Try again in a few minutes." } },
});

authRouter.post("/login", loginLimiter, validate(loginSchema), wrap(async (req, res) => {
  const { email, password } = req.body;
  const user = await one(
    `SELECT u.*, f.code AS flat_code
       FROM users u LEFT JOIN flats f ON f.id = u.flat_id
      WHERE u.email = $1`,
    [email],
  );

  /* Verify against a dummy hash when the account is unknown, so a missing
     account and a wrong password take the same time to answer. */
  const ok = user
    ? await verifyPassword(password, user.password_hash)
    : await verifyPassword(password, DUMMY_HASH);

  if (!user || !ok) throw unauthorized("Email or password is incorrect");
  if (user.status !== "active") throw unauthorized("This account is awaiting committee approval");

  const refresh = await issueRefreshToken(user.id);
  await audit(
    { societyId: user.society_id, userId: user.id, ip: req.ip },
    { action: "auth.login", entity: user.email },
  );

  res.json({
    accessToken: signAccessToken(user),
    refreshToken: refresh.token,
    expiresAt: refresh.expiresAt,
    user: publicUser(user),
  });
}));

authRouter.post("/refresh", validate(refreshSchema), wrap(async (req, res) => {
  const row = await consumeRefreshToken(req.body.refreshToken);
  if (!row) throw unauthorized("Session expired — sign in again");

  const user = await one(
    `SELECT u.*, f.code AS flat_code
       FROM users u LEFT JOIN flats f ON f.id = u.flat_id
      WHERE u.id = $1`,
    [row.user_id],
  );
  if (!user || user.status !== "active") throw unauthorized("Account is no longer active");

  const refresh = await issueRefreshToken(user.id);
  res.json({
    accessToken: signAccessToken(user),
    refreshToken: refresh.token,
    expiresAt: refresh.expiresAt,
    user: publicUser(user),
  });
}));

authRouter.post("/logout", requireAuth, wrap(async (req, res) => {
  await revokeAllForUser(req.user.id);
  await audit(auditCtx(req), { action: "auth.logout", entity: req.user.email });
  res.status(204).end();
}));

/** Self-registration. Creates a pending application, never a live account. */
authRouter.post("/register", validate(registrationSchema), wrap(async (req, res) => {
  const { name, flatCode, relation, phone, email, password } = req.body;

  const society = await one("SELECT id FROM societies ORDER BY created_at LIMIT 1");
  if (!society) throw notFound("No society is configured yet");

  const flat = await one("SELECT id FROM flats WHERE society_id = $1 AND code = $2", [society.id, flatCode]);
  if (!flat) throw conflict(`Flat ${flatCode} is not on the society register`);

  const existing = await one("SELECT id FROM users WHERE society_id = $1 AND email = $2", [society.id, email]);
  if (existing) throw conflict("That email already has an account");

  const pending = await one(
    "SELECT id FROM registrations WHERE society_id = $1 AND email = $2 AND status = 'pending'",
    [society.id, email],
  );
  if (pending) throw conflict("An application for that email is already awaiting approval");

  const passwordHash = await hashPassword(password);
  const reg = await tx(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO registrations (society_id, name, flat_code, relation, phone, email, password_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, name, flat_code, status, created_at`,
      [society.id, name, flatCode, relation, phone, email, passwordHash],
    );
    await audit(
      { societyId: society.id, userId: null, ip: req.ip },
      { action: "registration.submit", entity: name, entityId: rows[0].id, detail: `${relation} · ${flatCode}` },
      client,
    );
    return rows[0];
  });

  res.status(201).json({
    id: reg.id,
    status: reg.status,
    message: "Registration submitted. The committee will verify your documents and approve access.",
  });
}));

/* A real scrypt hash of a random string, used only to equalise timing. */
const DUMMY_HASH = "scrypt$32768$8$1$YWJjZGVmZ2hpamtsbW5vcA==$" +
  "Q2hlY2tpbmdBZ2FpbnN0VGhpc0Fsd2F5c0ZhaWxzT0s9";

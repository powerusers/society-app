import { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import rateLimit from "express-rate-limit";
import { setupSchema, createInviteSchema, DEFAULT_HEADS } from "@gvs/shared";
import { createInvite, listInvites, revokeInvite, claimInvite, attachInviteToSociety } from "../lib/invites.js";
import { many, one, tx } from "../db/pool.js";
import { config } from "../config.js";
import { validate } from "../middleware/validate.js";
import { hashPassword } from "../lib/password.js";
import { signAccessToken, issueRefreshToken } from "../lib/tokens.js";
import { audit } from "../lib/audit.js";
import { publicUser } from "../lib/serialize.js";
import { forbidden, conflict, notFound, wrap, AppError } from "../lib/errors.js";

export const setupRouter = Router();

/* Bootstrap runs against an empty database, so there is no account to
   authenticate and no committee to approve anything. Two things stand in for
   that: an operator-set token, and the fact that a society already existing
   closes the door permanently. */

const setupLimiter = rateLimit({
  windowMs: 15 * 60_000,
  /* Ten attempts an hour-quarter is the brake on guessing an invite code in
     production. Outside it the limit only throttles the test suite, which
     redeems codes far faster than any person would. */
  limit: config.isProd ? 10 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "rate_limited", message: "Too many attempts. Try again in a few minutes." } },
});

const societyExists = async () => Boolean(await one("SELECT id FROM societies LIMIT 1"));

/** Compares without leaking the answer through how long it took. */
function timingSafeEqualStr(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Issuing and revoking invites is the operator's own key — never an invite. */
const requireOperator = (req, _res, next) => {
  if (!config.setupToken) {
    return next(new AppError(503, "setup_unavailable", "SETUP_TOKEN is not set on this API."));
  }
  if (!timingSafeEqualStr(req.get("x-setup-token") || "", config.setupToken)) {
    return next(forbidden("That setup token is not correct."));
  }
  next();
};

setupRouter.get("/invites", requireOperator, wrap(async (_req, res) => {
  res.json({ invites: await listInvites() });
}));

setupRouter.post("/invites", requireOperator, validate(createInviteSchema), wrap(async (req, res) => {
  const invite = await createInvite(req.body);
  /* The code is in this response and nowhere else — only its hash is stored,
     so a lost code is reissued rather than looked up. */
  res.status(201).json({ invite });
}));

setupRouter.delete("/invites/:id", requireOperator, wrap(async (req, res) => {
  const gone = await revokeInvite(req.params.id);
  if (!gone) throw notFound("No open invite with that id");
  res.status(204).end();
}));

/**
 * Lets the sign-in screen decide whether to offer setup. It reveals only
 * whether the instance has been claimed — which anyone can infer anyway by
 * watching whether the app shows a login form.
 */
setupRouter.get("/status", wrap(async (_req, res) => {
  res.json({ needsSetup: !(await societyExists()), tokenConfigured: Boolean(config.setupToken) });
}));

/**
 * The societies a resident can apply to. Unauthenticated, because it is read
 * before anybody has an account.
 *
 * Carries name and address only — enough to recognise your own building, and
 * nothing about who lives there or what they owe. That a society uses this app
 * is inherently public the moment its residents can sign up; the flat register
 * behind it stays private.
 */
setupRouter.get("/societies", wrap(async (req, res) => {
  const q = String(req.query.q || "").trim();
  const rows = await many(
    `SELECT id, name, address FROM societies
      WHERE ($1 = '' OR name ILIKE '%' || $1 || '%' OR address ILIKE '%' || $1 || '%')
      ORDER BY name LIMIT 50`,
    [q],
  );
  res.json({ societies: rows });
}));

setupRouter.post("/", setupLimiter, validate(setupSchema), wrap(async (req, res) => {
  /* Unguarded, this endpoint would hand society-wide administrator rights to
     whoever reached a freshly deployed URL first. Refusing to run is the only
     safe default: an operator can set the variable, but nobody outside the
     deployment can. */
  if (!config.setupToken) {
    throw new AppError(503, "setup_unavailable",
      "Set SETUP_TOKEN in the API environment before running first-time setup.");
  }

  const { society, admin } = req.body;
  const offered = req.get("x-setup-token") || "";
  if (!offered) throw forbidden("Enter your invite code.");

  /* Two credentials arrive through the same header, because to the person
     typing it there is one box. The operator token is the master key and is
     never shared; an invite is the thing you hand to a secretary — one
     society, one use, expiring, and revocable on its own. */
  const isOperator = timingSafeEqualStr(offered, config.setupToken);
  const passwordHash = await hashPassword(admin.password);

  const created = await tx(async (c) => {
    let invite = null;
    if (!isOperator) {
      const claim = await claimInvite(c, offered, { societyName: society.name, email: admin.email });
      if (!claim.ok) throw forbidden(claim.reason);
      invite = claim.invite;
    }
    /* Serialise creation so two requests for the same society name cannot both
       pass their checks and land as duplicates residents could not tell apart.
       The unique index on lower(name) is the real guarantee; this turns the
       race into a clean error rather than a constraint violation. */
    await c.query("SELECT pg_advisory_xact_lock(hashtext('society_create'))");
    const clash = await c.query("SELECT id FROM societies WHERE lower(name) = lower($1)", [society.name]);
    if (clash.rows.length) throw conflict(`A society called "${society.name}" already exists here.`);

    const taken = await c.query("SELECT id FROM users WHERE email = $1", [admin.email]);
    if (taken.rows.length) throw conflict("That email already has an account on this platform.");

    const { rows: [row] } = await c.query(
      `INSERT INTO societies (name, address, reg_no, gstin, settings, bank)
       VALUES ($1,$2,$3,$4,$5::jsonb,'{}'::jsonb) RETURNING id, name`,
      [
        society.name, society.address, society.regNo, society.gstin,
        JSON.stringify({
          lateFeePct: 2, gracePeriodDays: 0, overstayMins: 20, settlementMins: 30,
          slaHours: { high: 4, medium: 24, low: 72 },
          finYear: financialYear(),
          /* Empty until a register is imported. Deriving blocks from the flats
             keeps the registration dropdown honest instead of offering wings
             the society does not have. */
          blocks: [],
        }),
      ],
    );

    /* Standard heads, so the first billing run has something to compute. They
       are ordinary rows: the treasurer edits rates in Settings afterwards. */
    for (const [i, h] of DEFAULT_HEADS.entries()) {
      await c.query(
        "INSERT INTO charge_heads (society_id, code, name, basis, rate, gst, sort) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [row.id, h.id, h.name, h.basis, h.rate, h.gst, i],
      );
    }

    const { rows: [user] } = await c.query(
      `INSERT INTO users (society_id, name, email, phone, password_hash, role, designation, status)
       VALUES ($1,$2,$3,$4,$5,'admin',$6,'active')
       RETURNING *`,
      [row.id, admin.name, admin.email, admin.phone || "", passwordHash, admin.designation || "Secretary"],
    );

    /* A society with no gate cannot admit a visitor, and the gate screens need
       one to exist before anybody can add more. */
    await c.query(
      "INSERT INTO gates (society_id, name, device, features) VALUES ($1,'Main gate','',$2)",
      [row.id, ["visitor-entry", "qr-scan"]],
    );

    /* Recorded only now the society exists, and inside the same transaction:
       a setup that fails after redemption rolls the code back with it, rather
       than burning a single-use invite on an attempt that created nothing. */
    if (invite) await attachInviteToSociety(c, invite.id, row.id);

    return { society: row, user, invite };
  });

  const refresh = await issueRefreshToken(created.user.id);
  await audit(
    { societyId: created.society.id, userId: created.user.id, ip: req.ip },
    {
      action: "society.setup",
      entity: created.society.name,
      detail: created.invite ? `invite ${created.invite.label || created.invite.id}` : "operator token",
    },
  );

  res.status(201).json({
    accessToken: signAccessToken(created.user),
    refreshToken: refresh.token,
    expiresAt: refresh.expiresAt,
    user: publicUser(created.user),
    society: { id: created.society.id, name: created.society.name },
  });
}));

/** April to March, the Indian financial year these societies file against. */
function financialYear(now = new Date()) {
  const y = now.getFullYear();
  const start = now.getMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { setupSchema, DEFAULT_HEADS } from "@gvs/shared";
import { one, tx } from "../db/pool.js";
import { config } from "../config.js";
import { validate } from "../middleware/validate.js";
import { hashPassword } from "../lib/password.js";
import { signAccessToken, issueRefreshToken } from "../lib/tokens.js";
import { audit } from "../lib/audit.js";
import { publicUser } from "../lib/serialize.js";
import { forbidden, conflict, wrap, AppError } from "../lib/errors.js";

export const setupRouter = Router();

/* Bootstrap runs against an empty database, so there is no account to
   authenticate and no committee to approve anything. Two things stand in for
   that: an operator-set token, and the fact that a society already existing
   closes the door permanently. */

const setupLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "rate_limited", message: "Too many attempts. Try again in a few minutes." } },
});

const societyExists = async () => Boolean(await one("SELECT id FROM societies LIMIT 1"));

/**
 * Lets the sign-in screen decide whether to offer setup. It reveals only
 * whether the instance has been claimed — which anyone can infer anyway by
 * watching whether the app shows a login form.
 */
setupRouter.get("/status", wrap(async (_req, res) => {
  res.json({ needsSetup: !(await societyExists()), tokenConfigured: Boolean(config.setupToken) });
}));

setupRouter.post("/", setupLimiter, validate(setupSchema), wrap(async (req, res) => {
  /* Without a token this endpoint would hand society-wide administrator rights
     to whoever reached a freshly deployed URL first. Refusing to run is the
     only safe default: an operator can set the variable, but nobody outside
     the deployment can. */
  if (!config.setupToken) {
    throw new AppError(503, "setup_unavailable",
      "Set SETUP_TOKEN in the API environment before running first-time setup.");
  }
  const offered = req.get("x-setup-token") || "";
  if (offered !== config.setupToken) throw forbidden("That setup token is not correct.");

  if (await societyExists()) throw conflict("This instance already has a society configured.");

  const { society, admin } = req.body;
  const passwordHash = await hashPassword(admin.password);

  const created = await tx(async (c) => {
    /* Serialise concurrent bootstraps. Without this, two requests can both
       pass the existence check above and both create a society, leaving the
       instance with two and no way to tell which one is real. */
    await c.query("SELECT pg_advisory_xact_lock(hashtext('society_bootstrap'))");
    const again = await c.query("SELECT id FROM societies LIMIT 1");
    if (again.rows.length) throw conflict("This instance already has a society configured.");

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

    return { society: row, user };
  });

  const refresh = await issueRefreshToken(created.user.id);
  await audit(
    { societyId: created.society.id, userId: created.user.id, ip: req.ip },
    { action: "society.setup", entity: created.society.name },
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

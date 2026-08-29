import { Router } from "express";
import { z } from "zod";
import { query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { pushConfigured } from "../lib/push.js";
import { wrap } from "../lib/errors.js";

export const devicesRouter = Router();
devicesRouter.use(requireAuth);

const registerSchema = z.object({
  token: z.string().trim().min(1, "A device token is required").max(4096),
  platform: z.enum(["android", "ios", "web"]).default("android"),
});

const unregisterSchema = z.object({
  token: z.string().trim().min(1).max(4096),
});

/**
 * Registers this device against the signed-in user.
 *
 * Idempotent, and re-points the token rather than adding a row: the app calls
 * this on every launch and on every FCM token refresh, and a phone that changes
 * hands must stop delivering the previous resident's visitors. The unique
 * constraint on token is what makes the upsert do that.
 *
 * Deliberately not audited. This is the app reporting where it can be reached,
 * not a member changing anything about the society, and one row per launch per
 * device would bury the audit trail it is supposed to make readable.
 */
devicesRouter.post("/", validate(registerSchema), wrap(async (req, res) => {
  const { token, platform } = req.body;

  await query(
    `INSERT INTO device_tokens (user_id, token, platform)
          VALUES ($1, $2, $3)
     ON CONFLICT (token) DO UPDATE
            SET user_id = EXCLUDED.user_id,
                platform = EXCLUDED.platform,
                last_seen_at = now()`,
    [req.user.id, token, platform],
  );

  /* The client is told whether pushes will actually arrive. Without this the app
     cannot tell "registered and working" from "registered against a deployment
     with no FCM credentials", and would promise the resident notifications that
     are never coming. */
  res.json({ registered: true, pushConfigured: pushConfigured() });
}));

/**
 * Drops this device. Called on sign-out, so the next person to use the phone
 * does not receive the last one's gate requests.
 *
 * Scoped to the caller: a token is a delivery address, and letting anyone delete
 * an arbitrary one would let them silence another resident's gate alerts.
 */
devicesRouter.delete("/", validate(unregisterSchema), wrap(async (req, res) => {
  await query("DELETE FROM device_tokens WHERE token = $1 AND user_id = $2", [req.body.token, req.user.id]);
  res.status(204).end();
}));

export default devicesRouter;

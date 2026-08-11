import { query } from "../db/pool.js";

/**
 * Appends to the audit trail. Pass `client` when inside a transaction so the
 * audit row commits or rolls back with the change it describes.
 */
export async function audit(ctx, { action, entity = "", entityId = null, detail = "" }, client) {
  const run = client ? client.query.bind(client) : query;
  await run(
    `INSERT INTO audit_log (society_id, actor_id, action, entity, entity_id, detail, ip)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [ctx.societyId ?? null, ctx.userId ?? null, action, entity, entityId, detail, ctx.ip ?? null],
  );
}

/** Pulls the audit context off a request without dragging the whole req around. */
export const auditCtx = (req) => ({
  societyId: req.user?.society_id ?? null,
  userId: req.user?.id ?? null,
  ip: req.ip,
});

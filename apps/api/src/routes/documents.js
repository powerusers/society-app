import { Router } from "express";
import { z } from "zod";
import { can, documentKey, requestUploadSchema, listQuerySchema, MAX_DOCUMENT_BYTES } from "@gvs/shared";
import { many, one, query, tx } from "../db/pool.js";
import { requireAuth, requireCap } from "../middleware/auth.js";
import { validate, validateQuery } from "../middleware/validate.js";
import { audit, auditCtx } from "../lib/audit.js";
import {
  presignUpload, presignDownload, headObject, deleteObject, storageConfigured,
} from "../lib/storage.js";
import { AppError, badRequest, conflict, forbidden, notFound, wrap } from "../lib/errors.js";

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

const serialize = (d) => ({
  id: d.id,
  name: d.name,
  category: d.category,
  visibility: d.visibility,
  contentType: d.content_type,
  sizeBytes: Number(d.size_bytes),
  status: d.status,
  uploadedBy: d.uploaded_by,
  uploadedByName: d.uploaded_by_name ?? null,
  at: d.created_at,
});

/** Committee-only documents stay out of a resident's list entirely. */
const visibleTo = (user) => (can(user.role, "document.write") ? null : "residents");

const ensureStorage = () => {
  if (!storageConfigured()) {
    throw new AppError(503, "storage_unconfigured", "Document storage is not configured on this server");
  }
};

documentsRouter.get("/", validateQuery(listQuerySchema), wrap(async (req, res) => {
  const params = [req.user.society_id];
  const where = ["d.society_id = $1", "d.status = 'ready'"];

  const limitTo = visibleTo(req.user);
  if (limitTo) { params.push(limitTo); where.push(`d.visibility = $${params.length}`); }

  if (req.validQuery.category) {
    params.push(req.validQuery.category);
    where.push(`d.category = $${params.length}`);
  }

  params.push(req.validQuery.limit, req.validQuery.offset);
  const rows = await many(
    `SELECT d.*, u.name AS uploaded_by_name
       FROM documents d LEFT JOIN users u ON u.id = d.uploaded_by
      WHERE ${where.join(" AND ")}
      ORDER BY d.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  res.json({ documents: rows.map(serialize) });
}));

/**
 * Step 1 of an upload. Records a pending row and hands back a presigned POST.
 *
 * The key is built from the society and the new row's id — never from anything
 * the client sent — so one society cannot write into another's prefix and a
 * crafted filename cannot escape the intended path.
 */
documentsRouter.post("/upload-url", requireCap("document.write"), validate(requestUploadSchema), wrap(async (req, res) => {
  ensureStorage();
  const { name, fileName, category, visibility, contentType, sizeBytes } = req.body;

  const created = await one(
    `INSERT INTO documents (society_id, name, category, visibility, storage_key, content_type, size_bytes, uploaded_by)
     VALUES ($1,$2,$3,$4,'',$5,$6,$7) RETURNING *`,
    [req.user.society_id, name, category, visibility, contentType, sizeBytes, req.user.id],
  );

  const key = documentKey({ societyId: req.user.society_id, documentId: created.id, fileName });
  await query("UPDATE documents SET storage_key = $1 WHERE id = $2", [key, created.id]);

  const upload = await presignUpload({ key, contentType, maxBytes: MAX_DOCUMENT_BYTES });

  res.status(201).json({
    document: serialize({ ...created, storage_key: key }),
    upload: {
      url: upload.url,
      fields: upload.fields,
      expiresIn: upload.expiresIn,
      maxBytes: upload.maxBytes,
      // the browser posts these fields plus `file`, in that order, as multipart/form-data
      method: "POST",
    },
  });
}));

/**
 * Step 2. The client calls this once S3 accepted the body; the server confirms
 * the object is really there and records what actually arrived rather than what
 * was promised.
 */
documentsRouter.post("/:id/complete", requireCap("document.write"), wrap(async (req, res) => {
  ensureStorage();
  const doc = await one(
    "SELECT * FROM documents WHERE id = $1 AND society_id = $2",
    [req.params.id, req.user.society_id],
  );
  if (!doc) throw notFound("No such document");
  if (doc.status === "ready") throw conflict("This upload has already been completed");
  if (doc.uploaded_by !== req.user.id && !can(req.user.role, "settings.view")) {
    throw forbidden("Only the uploader can complete this upload");
  }

  const head = await headObject(doc.storage_key);
  if (!head.exists) throw badRequest("The file has not reached storage yet");

  if (head.size > MAX_DOCUMENT_BYTES) {
    // S3's own condition should have refused it; clean up rather than trust it
    await deleteObject(doc.storage_key).catch(() => {});
    await query("DELETE FROM documents WHERE id = $1", [doc.id]);
    throw badRequest("That file is larger than the 25 MB limit");
  }

  const updated = await tx(async (client) => {
    const { rows } = await client.query(
      `UPDATE documents SET status = 'ready', size_bytes = $1, content_type = $2, completed_at = now()
        WHERE id = $3 RETURNING *`,
      [head.size, head.contentType || doc.content_type, doc.id],
    );
    await audit(auditCtx(req), {
      action: "document.upload", entity: doc.name, entityId: doc.id,
      detail: `${doc.category} · ${doc.visibility} · ${head.size} bytes`,
    }, client);
    return rows[0];
  });

  res.json({ document: serialize({ ...updated, uploaded_by_name: req.user.name }) });
}));

/** Short-lived download link, issued per request and recorded in the trail. */
documentsRouter.get("/:id/download", wrap(async (req, res) => {
  ensureStorage();
  const doc = await one(
    "SELECT * FROM documents WHERE id = $1 AND society_id = $2",
    [req.params.id, req.user.society_id],
  );
  if (!doc || doc.status !== "ready") throw notFound("No such document");

  const limitTo = visibleTo(req.user);
  if (limitTo && doc.visibility !== limitTo) throw notFound("No such document");

  const { url, expiresIn } = await presignDownload({
    key: doc.storage_key, fileName: doc.name, contentType: doc.content_type,
  });
  await audit(auditCtx(req), { action: "document.download", entity: doc.name, entityId: doc.id });

  res.json({ url, expiresIn, document: serialize(doc) });
}));

documentsRouter.delete("/:id", requireCap("document.write"), wrap(async (req, res) => {
  ensureStorage();
  const doc = await one(
    "SELECT * FROM documents WHERE id = $1 AND society_id = $2",
    [req.params.id, req.user.society_id],
  );
  if (!doc) throw notFound("No such document");

  /* Remove the row first: an orphaned object costs storage, whereas a row
     pointing at a deleted object breaks every download that follows. */
  await tx(async (client) => {
    await client.query("DELETE FROM documents WHERE id = $1", [doc.id]);
    await audit(auditCtx(req), {
      action: "document.delete", entity: doc.name, entityId: doc.id, detail: doc.category,
    }, client);
  });
  await deleteObject(doc.storage_key).catch((err) => {
    console.error(`[documents] object ${doc.storage_key} left behind: ${err.message}`);
  });

  res.status(204).end();
}));

/**
 * Sweeps uploads that were started and abandoned — a browser closed mid-upload
 * leaves a pending row and possibly a stray object.
 */
documentsRouter.post("/sweep", requireCap("settings.view"), validate(z.object({
  olderThanHours: z.number().int().min(1).max(720).default(24),
})), wrap(async (req, res) => {
  const stale = await many(
    `SELECT id, storage_key FROM documents
      WHERE society_id = $1 AND status = 'pending'
        AND created_at < now() - make_interval(hours => $2)`,
    [req.user.society_id, req.body.olderThanHours],
  );
  for (const d of stale) {
    if (storageConfigured()) await deleteObject(d.storage_key).catch(() => {});
    await query("DELETE FROM documents WHERE id = $1", [d.id]);
  }
  if (stale.length) {
    await audit(auditCtx(req), { action: "document.sweep", entity: "abandoned uploads", detail: `${stale.length} removed` });
  }
  res.json({ removed: stale.length });
}));

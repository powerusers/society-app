import { useCallback, useMemo } from "react";
import { useApp } from "../store";
import { useQuery } from "../lib/query";
import { api, uploadToStorage, isLive } from "../lib/api";
import { humanSize } from "@gvs/shared";

/**
 * The document vault.
 *
 * In live mode this drives the real three-step S3 upload: ask the API for a
 * presigned POST, send the file straight to the bucket, then tell the API to
 * confirm it landed. Demo mode keeps recording metadata only, which is all it
 * ever did.
 */
export function useDocuments() {
  const { live, me, can, say, db, add, remove, logAudit } = useApp();

  const q = useQuery(
    () => api.get("/api/documents?limit=100").then((r) => r.documents),
    { enabled: live && !!me, deps: [me?.id], initial: [] },
  );

  const localDocs = useMemo(
    () => db.documents.map((d) => ({
      id: d.id, name: d.name, category: d.category, visibility: "residents",
      sizeBytes: 0, sizeLabel: d.size, uploadedByName: null, uploadedBy: d.by, at: d.at, status: "ready",
    })),
    [db.documents],
  );

  const documents = live
    ? (q.data || []).map((d) => ({ ...d, sizeLabel: humanSize(d.sizeBytes) }))
    : localDocs;

  /**
   * @param file  a File from an <input type="file">
   * @param meta  { name, category, visibility }
   * @param onProgress 0–100 while the bytes are in flight
   */
  const upload = useCallback(async (file, meta, onProgress) => {
    if (!live) {
      add("documents", {
        name: meta.name, category: meta.category, size: humanSize(file?.size || 0),
        by: me.id, at: new Date().toISOString(),
      });
      logAudit("document.upload", meta.name, meta.category);
      say("Document uploaded");
      return { ok: true };
    }

    try {
      const { document, upload: presigned } = await api.post("/api/documents/upload-url", {
        name: meta.name,
        fileName: file.name,
        category: meta.category,
        visibility: meta.visibility || "residents",
        contentType: file.type,
        sizeBytes: file.size,
      });

      await uploadToStorage(presigned, file, onProgress);
      await api.post(`/api/documents/${document.id}/complete`, {});
      await q.refetch();
      say("Document uploaded");
      return { ok: true };
    } catch (err) {
      say(err.message, "bad");
      return { ok: false, error: err };
    }
  }, [live, add, me, logAudit, q, say]);

  /** Fetches a fresh short-lived link and hands it to the browser. */
  const download = useCallback(async (doc) => {
    if (!live) { say("Downloads need the API — this build stores metadata only.", "bad"); return { ok: false }; }
    try {
      const { url } = await api.get(`/api/documents/${doc.id}/download`);
      window.open(url, "_blank", "noopener");
      return { ok: true };
    } catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, say]);

  const destroy = useCallback(async (doc) => {
    if (!live) { remove("documents", doc.id); say("Document removed"); return { ok: true }; }
    try {
      await api.del(`/api/documents/${doc.id}`);
      await q.refetch();
      say("Document removed");
      return { ok: true };
    } catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, remove, q, say]);

  return {
    documents,
    loading: live ? q.loading && !q.data?.length : false,
    error: live ? q.error : null,
    refetch: q.refetch,
    upload, download, destroy,
    canWrite: can("document.write"),
    /** Downloads only work against real storage. */
    canDownload: live,
  };
}

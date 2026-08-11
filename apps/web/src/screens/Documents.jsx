import { useMemo, useRef, useState } from "react";
import Icons from "../icons";
import { Badge, Btn, Empty, SearchBar, Chips, Sheet, Input, Select, Alert, SkeletonList, Bar } from "../components/ui";
import { DOCUMENT_CATEGORIES, ALLOWED_CONTENT_TYPES, MAX_DOCUMENT_BYTES, humanSize } from "@gvs/shared";
import { useApp } from "../store";
import { useDocuments } from "../data/documents";
import { fmtDate } from "../lib/format";

const ACCEPT = Object.keys(ALLOWED_CONTENT_TYPES).join(",");

export default function Documents() {
  const { sel, can } = useApp();
  const { documents, loading, error, refetch, upload, download, destroy, canWrite, canDownload } = useDocuments();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [sheet, setSheet] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const docs = useMemo(() => {
    const t = q.trim().toLowerCase();
    return documents
      .filter((d) => cat === "all" || d.category === cat)
      .filter((d) => !t || d.name.toLowerCase().includes(t));
  }, [documents, q, cat]);

  return (
    <>
      {canWrite && (
        <Btn block icon={Icons.Upload} style={{ marginBottom: 12 }} onClick={() => setSheet(true)}>Upload a document</Btn>
      )}

      {error && (
        <Alert kind="err" icon={Icons.AlertTri}>
          {error.message} <button className="linkbtn" style={{ color: "inherit", textDecoration: "underline" }} onClick={refetch}>Retry</button>
        </Alert>
      )}

      <SearchBar value={q} onChange={setQ} placeholder="Search documents…" />
      <Chips value={cat} onChange={setCat}
        options={[{ value: "all", label: "All" }, ...DOCUMENT_CATEGORIES.map((c) => ({ value: c, label: c }))]} />

      {loading ? <SkeletonList rows={4} /> : (
        <div className="list">
          {docs.map((d) => (
            <div key={d.id} className={`li ${canDownload ? "tap" : ""}`}
              onClick={canDownload ? async () => { setBusyId(d.id); await download(d); setBusyId(null); } : undefined}>
              <div className="ico-tile plain"><Icons.Doc size={17} /></div>
              <div className="grow">
                <p className="h4 truncate">{d.name}</p>
                <p className="tiny" style={{ marginTop: 3 }}>
                  {d.sizeLabel || humanSize(d.sizeBytes)} · {d.uploadedByName || sel.userName(d.uploadedBy)} · {fmtDate(d.at)}
                </p>
                <div className="wrap" style={{ marginTop: 6 }}>
                  <Badge>{d.category}</Badge>
                  {d.visibility === "committee" && <Badge color="purple"><Icons.Lock size={10} /> Committee only</Badge>}
                </div>
              </div>
              {busyId === d.id
                ? <span className="tiny">Opening…</span>
                : canDownload && <Icons.Download size={16} style={{ color: "var(--accent)" }} />}
              {canWrite && (
                <button className="x" style={{ marginLeft: 8, background: "var(--bad-bg)", color: "var(--bad)" }}
                  aria-label="Delete"
                  onClick={(e) => { e.stopPropagation(); destroy(d); }}>
                  <Icons.Trash size={14} />
                </button>
              )}
            </div>
          ))}
          {!docs.length && (
            <Empty icon={Icons.Folder} title="No documents here"
              note="Bye-laws, AGM minutes, audited accounts and contracts live here." />
          )}
        </div>
      )}

      {sheet && <UploadSheet onClose={() => setSheet(false)} upload={upload} canSetVisibility={can("document.write")} />}
    </>
  );
}

function UploadSheet({ onClose, upload, canSetVisibility }) {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [f, setF] = useState({ name: "", category: DOCUMENT_CATEGORIES[0], visibility: "residents" });
  const [err, setErr] = useState("");
  const [progress, setProgress] = useState(null);

  const pick = (e) => {
    const chosen = e.target.files?.[0];
    if (!chosen) return;
    setErr("");
    if (!ALLOWED_CONTENT_TYPES[chosen.type]) {
      setFile(null);
      return setErr("That file type is not accepted. Use PDF, an image, or an Office document.");
    }
    if (chosen.size > MAX_DOCUMENT_BYTES) {
      setFile(null);
      return setErr(`That file is ${humanSize(chosen.size)} — the limit is ${humanSize(MAX_DOCUMENT_BYTES)}.`);
    }
    setFile(chosen);
    setF((p) => ({ ...p, name: p.name || chosen.name }));
  };

  const submit = async () => {
    if (!file) return setErr("Choose a file to upload");
    if (!f.name.trim()) return setErr("Give the document a name");
    setProgress(0);
    const res = await upload(file, { ...f, name: f.name.trim() }, setProgress);
    setProgress(null);
    if (!res.ok) return setErr(res.error?.message || "Upload failed");
    onClose();
  };

  const uploading = progress !== null;

  return (
    <Sheet title="Upload a document" onClose={uploading ? () => {} : onClose}>
      <label className="dashed" style={{ display: "block", padding: 22, textAlign: "center", marginBottom: 14 }}>
        <Icons.Upload size={22} style={{ display: "block", margin: "0 auto 8px" }} />
        {file ? `${file.name} · ${humanSize(file.size)}` : "Choose a file"}
        <input ref={fileRef} type="file" accept={ACCEPT} style={{ display: "none" }} onChange={pick} disabled={uploading} />
      </label>

      <Input label="Display name" value={f.name} disabled={uploading}
        onChange={(e) => { setF((p) => ({ ...p, name: e.target.value })); setErr(""); }}
        placeholder="e.g. AGM Minutes — Jul 2026" />
      <Select label="Category" value={f.category} disabled={uploading}
        onChange={(e) => setF((p) => ({ ...p, category: e.target.value }))} options={DOCUMENT_CATEGORIES} />
      {canSetVisibility && (
        <Select label="Who can see this" value={f.visibility} disabled={uploading}
          onChange={(e) => setF((p) => ({ ...p, visibility: e.target.value }))}
          options={[
            { value: "residents", label: "All residents" },
            { value: "committee", label: "Committee only" },
          ]} />
      )}

      {uploading && (
        <div style={{ marginBottom: 14 }}>
          <div className="row" style={{ marginBottom: 6 }}>
            <span className="tiny">Uploading to secure storage…</span>
            <span className="tiny">{progress}%</span>
          </div>
          <Bar value={progress} max={100} />
        </div>
      )}

      {err && <p className="err" style={{ marginBottom: 10 }}>{err}</p>}
      <Btn block onClick={submit} disabled={uploading}>{uploading ? "Uploading…" : "Publish to residents"}</Btn>
      <p className="hint center" style={{ marginTop: 10 }}>
        The file goes straight from your device to the society's private storage — it never passes through the app server.
      </p>
    </Sheet>
  );
}

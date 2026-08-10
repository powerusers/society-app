import { useMemo, useState } from "react";
import Icons from "../icons";
import { Badge, Btn, Empty, SearchBar, Chips, Sheet, Input, Select } from "../components/ui";
import { useApp } from "../store";
import { fmtDate, iso } from "../lib/format";

const CATS = ["Meeting minutes", "Legal", "Accounts", "Compliance", "Contracts", "Facilities", "Circulars"];

export default function Documents() {
  const { db, can, sel, add, remove, say, logAudit } = useApp();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [sheet, setSheet] = useState(false);

  const docs = useMemo(() => {
    const t = q.trim().toLowerCase();
    return db.documents
      .filter((d) => cat === "all" || d.category === cat)
      .filter((d) => !t || d.name.toLowerCase().includes(t));
  }, [db.documents, q, cat]);

  return (
    <>
      {can("document.write") && (
        <Btn block icon={Icons.Upload} style={{ marginBottom: 12 }} onClick={() => setSheet(true)}>Upload a document</Btn>
      )}
      <SearchBar value={q} onChange={setQ} placeholder="Search documents…" />
      <Chips value={cat} onChange={setCat} options={[{ value: "all", label: "All" }, ...CATS.map((c) => ({ value: c, label: c }))]} />

      <div className="list">
        {docs.map((d) => (
          <div key={d.id} className="li">
            <div className="ico-tile"><Icons.Doc size={18} /></div>
            <div className="grow">
              <p className="h4 truncate">{d.name}</p>
              <p className="tiny" style={{ marginTop: 2 }}>{d.size} · {sel.userName(d.by)} · {fmtDate(d.at)}</p>
            </div>
            <Badge>{d.category}</Badge>
            {can("document.write") && (
              <button className="x" style={{ marginLeft: 6, background: "var(--red-bg)", color: "var(--red)" }}
                onClick={() => { remove("documents", d.id); say("Document removed"); }} aria-label="Delete"><Icons.Trash size={14} /></button>
            )}
          </div>
        ))}
        {!docs.length && <Empty icon={Icons.Folder} title="No documents here" note="Bye-laws, AGM minutes, audited accounts and contracts live here." />}
      </div>

      {sheet && <UploadSheet onClose={() => setSheet(false)} onSave={(f) => {
        add("documents", { ...f, at: iso() });
        logAudit("document.upload", f.name, f.category);
        say("Document uploaded ✓");
        setSheet(false);
      }} />}
    </>
  );
}

function UploadSheet({ onClose, onSave }) {
  const { me } = useApp();
  const [f, setF] = useState({ name: "", category: CATS[0], size: "—" });
  const [err, setErr] = useState("");
  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setF((p) => ({ ...p, name: file.name, size: `${Math.max(1, Math.round(file.size / 1024))} KB` }));
    setErr("");
  };
  return (
    <Sheet title="Upload a document" onClose={onClose}>
      <label className="dashed" style={{ display: "block", padding: 24, textAlign: "center", cursor: "pointer", marginBottom: 14 }}>
        <Icons.Upload size={26} style={{ display: "block", margin: "0 auto 7px" }} />
        {f.name || "Choose a file"}
        <input type="file" style={{ display: "none" }} onChange={onFile} />
      </label>
      <Input label="Display name" value={f.name} onChange={(e) => { setF((p) => ({ ...p, name: e.target.value })); setErr(""); }} placeholder="e.g. AGM Minutes — Jul 2026.pdf" />
      <Select label="Category" value={f.category} onChange={(e) => setF((p) => ({ ...p, category: e.target.value }))} options={CATS} />
      {err && <p className="err" style={{ marginBottom: 10 }}>{err}</p>}
      <Btn block onClick={() => {
        if (!f.name.trim()) return setErr("Pick a file or type a name");
        onSave({ ...f, by: me.id });
      }}>Publish to residents</Btn>
      <p className="hint center" style={{ marginTop: 10 }}>Files stay on this device in the demo build; wiring a storage bucket is a backend change.</p>
    </Sheet>
  );
}

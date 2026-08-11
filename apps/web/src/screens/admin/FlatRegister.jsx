import { useRef, useState } from "react";
import { REGISTER_TEMPLATE } from "@gvs/shared";
import Icons from "../../icons";
import { Btn, Alert, Stat, Empty, TextArea } from "../../components/ui";
import { useApp } from "../../store";
import { api } from "../../lib/api";
import { download } from "../../lib/format";

/**
 * Import the society's flat register from a spreadsheet.
 *
 * Always previewed before it is applied. A register is not a list of names:
 * carpet area multiplies every per-square-foot billing head, so a column read
 * as the wrong field would change what every flat is charged, quietly and
 * every month. Seeing the parsed rows first is what stops that.
 */
export default function FlatRegister() {
  const { live, say } = useApp();
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(null);
  const fileRef = useRef(null);

  const reset = () => { setPreview(null); setErr(""); setApplied(null); };

  const pickFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setCsv(await file.text());
    reset();
    e.target.value = "";
  };

  const run = async (mode) => {
    setErr(""); setBusy(true);
    try {
      const res = await api.post("/api/flats/import", { csv, mode });
      if (mode === "apply") {
        setApplied(res);
        setPreview(null);
        say(`Register imported — ${res.summary.create} added, ${res.summary.update} updated.`);
      } else setPreview(res);
    } catch (e) {
      setErr(e.message);
      /* Line-level complaints from an apply come back as details; surface them
         rather than making the admin re-run a preview to find out what broke. */
      if (e.details) setPreview({ summary: null, rows: Object.entries(e.details).map(([line, msg]) => ({ line, action: "invalid", errors: { _: msg } })) });
    } finally { setBusy(false); }
  };

  if (!live) {
    return (
      <Empty icon={Icons.Building} title="Available with the API connected"
        note="Importing writes to the society register, so it needs the live backend rather than the demo store." />
    );
  }

  const s = preview?.summary;
  const invalid = preview?.rows?.filter((r) => r.action === "invalid") || [];

  return (
    <>
      <Alert kind="info" icon={Icons.Info}>
        The register decides which flats exist — residents can only sign up against a flat listed
        here, and bills are raised per flat. Importing never deletes: a flat missing from your file
        is left alone, because removing one would take its bills and payments with it.
      </Alert>

      <div className="card">
        <p className="h4" style={{ marginBottom: 4 }}>1 · Your spreadsheet</p>
        <p className="tiny" style={{ marginBottom: 10 }}>
          A CSV with a header row. It needs a flat code column and a carpet area column; block,
          floor, type, occupancy and parking are optional. Column names are matched loosely, so
          "Flat No.", "Wing" and "Carpet Area" all work.
        </p>
        <div className="wrap" style={{ gap: 8 }}>
          <Btn size="sm" variant="outline" icon={Icons.Upload} onClick={() => fileRef.current?.click()}>
            Choose CSV file
          </Btn>
          <Btn size="sm" variant="ghost" icon={Icons.Download}
            onClick={() => download("flat-register-template.csv", REGISTER_TEMPLATE)}>
            Download template
          </Btn>
        </div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={pickFile} />
        {fileName && <p className="tiny" style={{ marginTop: 9 }}>Loaded <b>{fileName}</b></p>}

        <div style={{ marginTop: 12 }}>
          <TextArea label="Or paste it here" rows={6} value={csv} spellCheck={false}
            onChange={(e) => { setCsv(e.target.value); reset(); }}
            placeholder={REGISTER_TEMPLATE} style={{ fontFamily: "var(--mono)", fontSize: 12 }} />
        </div>
      </div>

      <Btn block disabled={!csv.trim() || busy} onClick={() => run("preview")} style={{ marginTop: 4 }}>
        {busy && !preview ? "Reading…" : "2 · Check the file"}
      </Btn>

      {err && !invalid.length && <p className="err" style={{ marginTop: 12 }}>{err}</p>}

      {applied && (
        <>
          <Alert kind="ok" icon={Icons.CheckCircle}>
            Register imported. {applied.summary.create} flats added, {applied.summary.update} updated,
            {" "}{applied.summary.unchanged} already matched. Blocks are now {applied.blocks.join(", ")}.
          </Alert>
          <p className="hint">Residents can now register against these flats, and the next billing run will cover them.</p>
        </>
      )}

      {preview && (
        <>
          {s && (
            <>
              <p className="h4" style={{ margin: "16px 0 8px" }}>3 · What this will do</p>
              <div className="grid3">
                <Stat value={s.create} label="New flats" />
                <Stat value={s.update} label="Changed" />
                <Stat value={s.unchanged} label="Already match" />
              </div>
            </>
          )}

          {invalid.length > 0 && (
            <>
              <Alert kind="err" icon={Icons.AlertTri}>
                {invalid.length} row{invalid.length === 1 ? "" : "s"} could not be read. Nothing is imported
                until every row is valid — fix these in the spreadsheet and check it again.
              </Alert>
              <div className="list">
                {invalid.slice(0, 40).map((r) => (
                  <div className="li" key={r.line}>
                    <div className="grow">
                      <p className="h4">{typeof r.line === "number" ? `Line ${r.line}` : r.line}{r.code ? ` · ${r.code}` : ""}</p>
                      {Object.values(r.errors).map((m, i) => (
                        <p className="tiny" key={i} style={{ marginTop: 3, color: "var(--bad)" }}>{m}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {invalid.length > 40 && <p className="hint">…and {invalid.length - 40} more.</p>}
            </>
          )}

          {s && s.invalid === 0 && (
            <>
              {s.create + s.update === 0 ? (
                <Alert kind="ok" icon={Icons.CheckCircle}>
                  Every flat in this file already matches the register. Nothing to import.
                </Alert>
              ) : (
                <>
                  <div className="list" style={{ marginTop: 12 }}>
                    {preview.rows.filter((r) => r.action !== "unchanged").slice(0, 30).map((r) => (
                      <div className="li" key={r.line}>
                        <div className="grow">
                          <p className="h4">{r.code}</p>
                          <p className="tiny" style={{ marginTop: 3 }}>
                            Block {r.flat.block} · floor {r.flat.floor} · {r.flat.type} · {r.flat.area} sqft
                            {" "}· {r.flat.occupancy} · {r.flat.parkingSlots} parking
                          </p>
                        </div>
                        <span className="badge">{r.action === "create" ? "new" : "changed"}</span>
                      </div>
                    ))}
                  </div>
                  <Btn block style={{ marginTop: 12 }} disabled={busy} onClick={() => run("apply")}>
                    {busy ? "Importing…" : `4 · Import ${s.create + s.update} flats`}
                  </Btn>
                </>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

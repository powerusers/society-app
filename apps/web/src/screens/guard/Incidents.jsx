import { useState } from "react";
import Icons from "../../icons";
import { Badge, Btn, Empty, Stat, Segmented, Sheet, TextArea, Alert, SkeletonList } from "../../components/ui";
import { IncidentRow } from "../../components/entities";
import { useApp } from "../../store";
import { useIncidents } from "../../data/incidents";
import { fmtDateTime } from "../../lib/format";

export default function Incidents() {
  const { can } = useApp();
  const { incidents, loading, error, refetch, close, reopen } = useIncidents();
  const [tab, setTab] = useState("open");
  const [closing, setClosing] = useState(null);

  const list = incidents.filter((i) => (tab === "all" ? true : i.status === tab));
  /* Closing an incident is a review, and the review is the committee's — the
     guard who wrote it is the person it protects, not the person who signs it
     off. So the button is offered on that capability, not on incident.write. */
  const mayReview = can("helpdesk.manage");

  return (
    <>
      <div className="grid3">
        <Stat value={incidents.filter((i) => i.status === "open").length} label="Open" color="var(--red)" />
        <Stat value={incidents.filter((i) => i.severity === "high").length} label="High severity" color="var(--amber)" />
        <Stat value={incidents.filter((i) => i.recording).length} label="With recording" color="var(--purple)" />
      </div>

      <div style={{ marginTop: 12 }}>
        <Segmented value={tab} onChange={setTab} options={[
          { value: "open", label: "Open" }, { value: "closed", label: "Closed" }, { value: "all", label: "All" },
        ]} />
      </div>

      {error && (
        <Alert kind="err" icon={Icons.AlertTri}>
          {error.message}{" "}
          <button className="linkbtn" style={{ color: "inherit", textDecoration: "underline" }} onClick={refetch}>Retry</button>
        </Alert>
      )}

      {loading ? <SkeletonList rows={3} /> : (
        <div className="list">
          {list.map((i) => (
            <div key={i.id}>
              <IncidentRow i={i} />
              <div style={{ padding: "0 14px 12px" }}>
                {i.status === "closed" && i.closedByName && (
                  <p className="tiny" style={{ marginBottom: mayReview ? 8 : 0 }}>
                    Reviewed by {i.closedByName} · {fmtDateTime(i.closedAt)}
                    {i.closingNote ? ` — ${i.closingNote}` : ""}
                  </p>
                )}
                {mayReview && (
                  i.status === "open" ? (
                    <Btn size="sm" variant="ghost" icon={Icons.Check} onClick={() => setClosing(i)}>
                      Mark reviewed &amp; close
                    </Btn>
                  ) : (
                    <button className="linkbtn" onClick={() => reopen(i)}>Reopen</button>
                  )
                )}
              </div>
            </div>
          ))}
          {!list.length && (
            <Empty icon={Icons.Shield} title="No incidents here"
              note="Anything the guard records with one tap lands in this register." />
          )}
        </div>
      )}

      {closing && (
        <CloseSheet i={closing} onClose={() => setClosing(null)}
          onConfirm={async (note) => { const r = await close(closing, note); if (r.ok) setClosing(null); return r; }} />
      )}
    </>
  );
}

/**
 * Closing one asks what was concluded.
 *
 * A register of incidents that all end in the word "closed" tells the next
 * committee nothing. The note is optional — some genuinely need no action —
 * but it is asked for, because that is when it is cheapest to write.
 */
function CloseSheet({ i, onConfirm, onClose }) {
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Sheet title="Close incident" onClose={onClose}>
      <div className="card flat">
        <p className="h4" style={{ textTransform: "capitalize" }}>{i.type} · {i.involves}</p>
        <p className="tiny" style={{ marginTop: 4 }}>{i.note}</p>
        <p className="tiny" style={{ marginTop: 6 }}>Recorded by {i.byName} · {fmtDateTime(i.at)}</p>
      </div>
      <TextArea label="What was concluded (optional)" value={note}
        onChange={(e) => { setNote(e.target.value); setErr(""); }}
        placeholder="e.g. Spoke to the resident who invited them. No further action." />
      {err && <p className="err" style={{ marginBottom: 10 }}>{err}</p>}
      <Btn block icon={Icons.Check} disabled={busy} onClick={async () => {
        setBusy(true);
        const res = await onConfirm(note.trim());
        setBusy(false);
        if (res?.ok === false) setErr(res.error?.message || "Could not close that");
      }}>{busy ? "Closing…" : "Close incident"}</Btn>
    </Sheet>
  );
}

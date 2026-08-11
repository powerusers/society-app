import { useState } from "react";
import Icons from "../../icons";
import { Badge, Btn, Empty, Stat, Alert, Sheet, Input, Select, TextArea, Chips } from "../../components/ui";
import { VisitorCard, overstay, CAT } from "../../components/entities";
import QR from "../../lib/qr";
import { useApp } from "../../store";
import { useActions } from "../../store/actions";
import { fmtTime, ago } from "../../lib/format";

export default function GuardGate({ nav }) {
  const { db, me, can } = useApp();
  const A = useActions();
  const [gateId, setGateId] = useState(me.gate || "gate_main");
  const [sheet, setSheet] = useState(null);

  const gate = db.gates.find((g) => g.id === gateId) || db.gates[0];
  const at = (v) => v.gateId === gateId;
  const waiting = db.visitors.filter((v) => v.status === "waiting" && at(v));
  const pending = db.visitors.filter((v) => v.status === "pending" && at(v));
  const cleared = db.visitors.filter((v) => (v.status === "approved" || v.status === "pre-approved") && at(v));
  const inside = db.visitors.filter((v) => v.status === "inside" && at(v));
  const alarms = inside.filter((v) => overstay(v, db.settings.overstayMins)?.over);
  const operate = can("gate.operate");

  return (
    <>
      <div className="card brand">
        <div className="row top">
          <div className="grow">
            <p className="sub" style={{ fontSize: 12, margin: 0 }}>On duty</p>
            <h2 className="h1" style={{ margin: "2px 0" }}>{me.name}</h2>
            <p className="sub" style={{ fontSize: 12, margin: 0 }}>{gate.name} · {me.shift || "Day shift"}</p>
          </div>
          <div className="right">
            <Badge className="solid">{gate.device}</Badge>
            <p className="sub" style={{ fontSize: 11, marginTop: 6 }}>
              <span className="blink green" style={{ display: "inline-block", marginRight: 5 }} />{gate.status}
            </p>
          </div>
        </div>
      </div>

      <Chips value={gateId} onChange={setGateId} options={db.gates.map((g) => ({ value: g.id, label: g.name }))} />

      <div className="grid3">
        <Stat value={waiting.length} label="At gate" color="var(--amber)" />
        <Stat value={pending.length} label="With flat" color="var(--blue)" />
        <Stat value={inside.length} label="Inside" color="var(--green)" />
      </div>

      {alarms.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Alert kind="err" icon={Icons.AlertTri}>
            <b>{alarms.length} overstay alarm{alarms.length > 1 ? "s" : ""}.</b> {alarms.map((v) => `${v.name} (${v.flatCode})`).join(", ")} crossed the {db.settings.overstayMins}-minute limit.
          </Alert>
        </div>
      )}

      <div className="grid2" style={{ marginTop: 12 }}>
        <Btn icon={Icons.Plus} onClick={() => setSheet("entry")}>New entry</Btn>
        <Btn variant="ghost" icon={Icons.QR} onClick={() => setSheet("scan")}>Scan pass</Btn>
        <Btn variant="ghost" icon={Icons.Finger} onClick={() => nav.switchTab("guardCheckin")}>Staff check-in</Btn>
        <Btn variant="ghost" icon={Icons.Radio} onClick={() => nav.go("walkie")}>Walkie-talkie</Btn>
      </div>

      <div style={{ marginTop: 6 }}>
        <Btn block variant="danger" icon={Icons.Mic} onClick={() => setSheet("incident")} style={{ marginTop: 9 }}>
          One-click misbehaviour recording
        </Btn>
      </div>

      {waiting.length > 0 && (
        <>
          <div className="sect"><h2 className="h2">⏳ At the gate</h2></div>
          {waiting.map((v) => (
            <VisitorCard key={v.id} v={v} accent="#FF9800" actions={operate && <>
              <Btn size="sm" icon={Icons.Send} onClick={() => A.sendToFlat(v)}>Send to flat</Btn>
              <Btn size="sm" variant="danger" icon={Icons.X} onClick={() => A.denyVisitor(v)}>Deny</Btn>
            </>} />
          ))}
        </>
      )}

      {pending.length > 0 && (
        <>
          <div className="sect"><h2 className="h2">📲 Waiting on the flat</h2></div>
          {pending.map((v) => (
            <VisitorCard key={v.id} v={v} accent="#1565C0" actions={<div className="alert warn" style={{ marginBottom: 0, width: "100%" }}>
              <span className="blink" />
              <span className="grow">Sent {ago(v.sentAt || v.createdAt)} — resident notified on app and smartwatch.</span>
            </div>} />
          ))}
        </>
      )}

      {cleared.length > 0 && (
        <>
          <div className="sect"><h2 className="h2">✅ Cleared — let in</h2></div>
          {cleared.map((v) => (
            <VisitorCard key={v.id} v={v} accent="#43A047" actions={operate && <>
              <Btn size="sm" icon={Icons.Check} onClick={() => A.admitVisitor(v)}>Allow entry</Btn>
              {v.passCode && <Badge color="brand">Pass {v.passCode}</Badge>}
            </>} />
          ))}
        </>
      )}

      {inside.length > 0 && (
        <>
          <div className="sect"><h2 className="h2">🏠 Inside the building</h2></div>
          {inside.map((v) => {
            const o = overstay(v, db.settings.overstayMins);
            return (
              <VisitorCard key={v.id} v={v} accent={o?.over ? "#E53935" : "#43A047"} actions={operate && <>
                <Btn size="sm" variant="ghost" icon={Icons.LogOut} onClick={() => A.exitVisitor(v)}>Mark exit</Btn>
                {o?.over && (
                  <Btn size="sm" variant="danger" icon={Icons.AlertTri} onClick={() => A.raiseIncident({
                    type: "overstay", severity: "medium", gateId, involves: `${v.name} · ${v.flatCode}`,
                    note: `Exceeded the ${o.limit}-minute limit by ${o.by} minutes.`,
                  })}>Log overstay</Btn>
                )}
              </>} />
            );
          })}
        </>
      )}

      {!waiting.length && !pending.length && !cleared.length && !inside.length && (
        <Empty icon={Icons.Gate} title="Gate is clear" note="New entries and pre-approved passes appear here." />
      )}

      {sheet === "entry" && <EntrySheet gateId={gateId} onClose={() => setSheet(null)} />}
      {sheet === "scan" && <ScanSheet gateId={gateId} onClose={() => setSheet(null)} />}
      {sheet === "incident" && <IncidentSheet gateId={gateId} onClose={() => setSheet(null)} />}
    </>
  );
}

function EntrySheet({ gateId, onClose }) {
  const { db, me, add, say } = useApp();
  const [f, setF] = useState({ name: "", category: "guest", flatCode: db.flats[0].code, phone: "", purpose: "", vehicle: "", photo: false });
  const u = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [err, setErr] = useState("");

  return (
    <Sheet title="New visitor entry" onClose={onClose}>
      <Alert kind="info">A request goes to the flat for approval. Nothing enters without the resident's yes — or a valid pre-approved pass.</Alert>
      <button className="dashed" style={{ marginBottom: 13, padding: 20 }} onClick={() => u("photo", !f.photo)}>
        <Icons.Camera size={22} style={{ display: "block", margin: "0 auto 6px" }} />
        {f.photo ? "Photo captured ✓ — tap to retake" : "Capture visitor photo"}
      </button>
      <Input label="Visitor name" value={f.name} onChange={(e) => { u("name", e.target.value); setErr(""); }} placeholder="e.g. Ramesh Kumar / Amazon" />
      <Select label="Type" value={f.category} onChange={(e) => u("category", e.target.value)}
        options={Object.entries(CAT).map(([k, v]) => ({ value: k, label: `${v.emoji} ${v.label}` }))} />
      <Select label="Visiting flat" value={f.flatCode} onChange={(e) => u("flatCode", e.target.value)}
        options={db.flats.map((x) => ({ value: x.code, label: `Flat ${x.code}` }))} />
      <Input label="Mobile" type="tel" value={f.phone} onChange={(e) => u("phone", e.target.value)} placeholder="Optional" />
      <Input label="Vehicle number" value={f.vehicle} onChange={(e) => u("vehicle", e.target.value)} placeholder="Optional — ANPR auto-fills at the main gate" />
      <Input label="Purpose" value={f.purpose} onChange={(e) => u("purpose", e.target.value)} placeholder="e.g. Package delivery" />
      {err && <p className="err" style={{ marginBottom: 10 }}>{err}</p>}
      <Btn block icon={Icons.Plus} onClick={() => {
        if (!f.name.trim()) return setErr("Enter the visitor's name");
        add("visitors", {
          ...f, name: f.name.trim(), gateId, status: "waiting", raisedBy: `Guard · ${me.name}`,
          createdAt: new Date().toISOString(),
          allowedMins: f.category === "delivery" ? db.settings.overstayMins : 240,
        });
        say("Entry recorded — send it to the flat.");
        onClose();
      }}>Record entry</Btn>
    </Sheet>
  );
}

/** Stands in for the device camera: type or paste the 6-character pass code. */
function ScanSheet({ gateId, onClose }) {
  const { db, say } = useApp();
  const A = useActions();
  const [code, setCode] = useState("");
  const [found, setFound] = useState(null);
  const [err, setErr] = useState("");

  const check = () => {
    const v = db.visitors.find((x) => x.passCode?.toUpperCase() === code.trim().toUpperCase());
    if (!v) return setErr("No matching gate pass. Ask the visitor to re-share it.");
    if (v.status === "exited" || v.status === "denied") return setErr("This pass has already been used or cancelled.");
    setErr(""); setFound(v);
  };

  return (
    <Sheet title="Scan gate pass" onClose={onClose}>
      {!found ? (
        <>
          <div className="card center" style={{ padding: 26 }}>
            <Icons.QR size={54} style={{ color: "var(--brand)", marginBottom: 10 }} />
            <p className="muted">Point the device camera at the resident's QR pass, or key in the 6-character code printed under it.</p>
          </div>
          <Input label="Pass code" value={code} maxLength={6} placeholder="e.g. K4M9TP"
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setErr(""); }} />
          {err && <p className="err" style={{ marginBottom: 10 }}>{err}</p>}
          <Btn block icon={Icons.Check} onClick={check}>Verify pass</Btn>
        </>
      ) : (
        <>
          <div className="alert ok"><Icons.CheckCircle size={17} /><span className="grow"><b>Valid pass.</b> Pre-approved by the flat.</span></div>
          <div className="card">
            <div className="row"><span className="muted">Visitor</span><b>{found.name}</b></div>
            <div className="hairline" />
            <div className="row"><span className="muted">Flat</span><b>{found.flatCode}</b></div>
            <div className="hairline" />
            <div className="row"><span className="muted">Type</span><b>{(CAT[found.category] || CAT.guest).label}</b></div>
            <div className="hairline" />
            <div className="row"><span className="muted">In-building limit</span><b>{found.allowedMins || db.settings.overstayMins} min</b></div>
          </div>
          <Btn block icon={Icons.Check} onClick={() => { A.admitVisitor(found); onClose(); }}>Allow entry & start timer</Btn>
        </>
      )}
    </Sheet>
  );
}

function IncidentSheet({ gateId, onClose }) {
  const A = useActions();
  const [f, setF] = useState({ type: "misbehaviour", severity: "high", involves: "", note: "" });
  const u = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [recording, setRecording] = useState(false);

  return (
    <Sheet title="Record an incident" onClose={onClose}>
      <button className="dashed" style={{ padding: 22, marginBottom: 14, borderColor: recording ? "var(--red)" : undefined, color: recording ? "var(--red)" : undefined }}
        onClick={() => setRecording((r) => !r)}>
        <Icons.Mic size={26} style={{ display: "block", margin: "0 auto 7px", animation: recording ? "pulse 1s infinite" : "none" }} />
        {recording ? "Recording… tap to stop" : "Tap to start recording"}
      </button>
      <Select label="Type" value={f.type} onChange={(e) => u("type", e.target.value)}
        options={[
          { value: "misbehaviour", label: "Misbehaviour with security" }, { value: "trespass", label: "Trespass / forced entry" },
          { value: "safety", label: "Safety hazard" }, { value: "vehicle", label: "Vehicle / parking" }, { value: "other", label: "Other" },
        ]} />
      <Select label="Severity" value={f.severity} onChange={(e) => u("severity", e.target.value)}
        options={[{ value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }]} />
      <Input label="Who / what is involved" value={f.involves} onChange={(e) => u("involves", e.target.value)} placeholder="e.g. Visitor at Main Gate, flat B-204" />
      <TextArea label="What happened" value={f.note} onChange={(e) => u("note", e.target.value)} />
      <Btn block variant="danger" icon={Icons.AlertTri} onClick={() => {
        A.raiseIncident({ ...f, gateId, involves: f.involves || "Unspecified" });
        onClose();
      }}>Save incident & alert committee</Btn>
      <p className="hint" style={{ textAlign: "center", marginTop: 10 }}>
        Recording, timestamp and gate device ID are attached automatically — evidence for the committee, protection for the guard.
      </p>
    </Sheet>
  );
}

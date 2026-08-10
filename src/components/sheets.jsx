import { useState } from "react";
import Icons from "../icons";
import { Sheet, Btn, Input, Select, TextArea, Alert, Badge, Segmented } from "./ui";
import QR from "../lib/qr";
import { useApp } from "../store";
import { useActions } from "../store/actions";
import { fmtDate, dayKey } from "../lib/format";
import { CAT } from "./entities";

/** Resident pre-approves a visitor and gets a shareable QR gate pass. */
export function PreApproveSheet({ onClose, flatCode }) {
  const { db, me } = useApp();
  const A = useActions();
  const [pass, setPass] = useState(null);
  const [f, setF] = useState({
    name: "", category: "guest", date: dayKey(), slot: "any", purpose: "", phone: "",
    recurring: "once", vehicle: "", gateId: "gate_main",
  });
  const u = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [err, setErr] = useState("");

  if (pass) return <GatePassSheet visitor={pass} onClose={onClose} />;

  const submit = () => {
    if (!f.name.trim()) return setErr("Enter the visitor's name");
    const v = A.preApprove({
      name: f.name.trim(), category: f.category, flatCode: flatCode || me.flat,
      purpose: f.purpose, phone: f.phone, vehicle: f.vehicle, gateId: f.gateId,
      expectedAt: `${f.date}T09:00:00.000Z`, recurring: f.recurring,
    });
    setPass(v);
  };

  return (
    <Sheet title="Pre-approve a visitor" onClose={onClose}>
      <Alert kind="ok" icon={Icons.CheckCircle}>
        Pre-approved visitors are let in by the guard without disturbing you. Share the QR pass and they can self check-in even at a guardless gate.
      </Alert>
      <Input label="Visitor name" placeholder="e.g. Kiran Deshpande / Swiggy" value={f.name} onChange={(e) => { u("name", e.target.value); setErr(""); }} />
      <Select label="Type" value={f.category} onChange={(e) => u("category", e.target.value)}
        options={Object.entries(CAT).filter(([k]) => k !== "staff").map(([k, v]) => ({ value: k, label: `${v.emoji} ${v.label}` }))} />
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><Input label="Expected on" type="date" value={f.date} onChange={(e) => u("date", e.target.value)} /></div>
        <div style={{ flex: 1 }}>
          <Select label="Repeats" value={f.recurring} onChange={(e) => u("recurring", e.target.value)}
            options={[{ value: "once", label: "One time" }, { value: "daily", label: "Every day" }, { value: "weekdays", label: "Mon–Fri" }, { value: "weekly", label: "Weekly" }]} />
        </div>
      </div>
      <Select label="Entry gate" value={f.gateId} onChange={(e) => u("gateId", e.target.value)}
        options={db.gates.map((g) => ({ value: g.id, label: g.name }))} />
      <Input label="Visitor mobile (optional)" type="tel" value={f.phone} onChange={(e) => u("phone", e.target.value)} placeholder="For pass delivery over SMS" />
      <Input label="Vehicle number (optional)" value={f.vehicle} onChange={(e) => u("vehicle", e.target.value)} placeholder="MH-12-AB-1234" />
      <Input label="Purpose" value={f.purpose} onChange={(e) => u("purpose", e.target.value)} placeholder="e.g. Dinner, furniture delivery" />
      {err && <p className="err" style={{ marginBottom: 10 }}>{err}</p>}
      <Btn block icon={Icons.QR} onClick={submit}>Create gate pass</Btn>
    </Sheet>
  );
}

export function GatePassSheet({ visitor, onClose }) {
  const { db, sel } = useApp();
  const payload = JSON.stringify({ p: visitor.passCode, f: visitor.flatCode, s: db.settings.societyName });
  return (
    <Sheet title="Gate pass" onClose={onClose}>
      <QR value={payload} caption={visitor.passCode} />
      <div className="card" style={{ marginTop: 16 }}>
        <div className="row"><span className="muted">Visitor</span><b>{visitor.name}</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Flat</span><b>{visitor.flatCode}</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Gate</span><b>{sel.gate(visitor.gateId)?.name}</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Valid</span><b>{visitor.expectedAt ? fmtDate(visitor.expectedAt) : "Today"}</b></div>
        {visitor.recurring && visitor.recurring !== "once" && (
          <>
            <div className="hairline" />
            <div className="row"><span className="muted">Repeats</span><Badge color="purple">{visitor.recurring}</Badge></div>
          </>
        )}
      </div>
      <Alert kind="info">The guard scans this at the gate, or the visitor scans the gate device's QR to self check-in. Entry is logged with photo and timestamp either way.</Alert>
      <div style={{ display: "flex", gap: 9 }}>
        <Btn variant="ghost" block icon={Icons.Send}
          onClick={() => navigator.share?.({ title: "Gate pass", text: `Gate pass for ${db.settings.societyName}: ${visitor.passCode}` }).catch(() => {})}>
          Share pass
        </Btn>
        <Btn block onClick={onClose}>Done</Btn>
      </div>
    </Sheet>
  );
}

export function RaiseTicketSheet({ onClose, defaultCategory }) {
  const { db, me } = useApp();
  const A = useActions();
  const [f, setF] = useState({ category: defaultCategory || "Plumbing", title: "", body: "", priority: "medium", source: "app" });
  const u = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [err, setErr] = useState("");
  const CATS = ["Plumbing", "Electrical", "Housekeeping", "Security", "Lift", "Parking", "Common area", "Billing", "Other"];

  return (
    <Sheet title="Raise a complaint" onClose={onClose}>
      <Select label="Category" value={f.category} onChange={(e) => u("category", e.target.value)} options={CATS} />
      <Input label="Subject" value={f.title} onChange={(e) => { u("title", e.target.value); setErr(""); }} placeholder="One line summary" />
      <TextArea label="Details" value={f.body} onChange={(e) => u("body", e.target.value)} placeholder="What is the problem, and where?" />
      <Select label="Priority" value={f.priority} onChange={(e) => u("priority", e.target.value)}
        options={[
          { value: "high", label: `High — ${db.settings.slaHours.high}h SLA` },
          { value: "medium", label: `Medium — ${db.settings.slaHours.medium}h SLA` },
          { value: "low", label: `Low — ${db.settings.slaHours.low}h SLA` },
        ]} />
      {err && <p className="err" style={{ marginBottom: 10 }}>{err}</p>}
      <Btn block icon={Icons.Send} onClick={() => {
        if (!f.title.trim()) return setErr("Add a short subject");
        A.raiseTicket({ ...f, flatCode: me.flat });
        onClose();
      }}>Submit ticket</Btn>
      <p className="hint" style={{ textAlign: "center", marginTop: 10 }}>
        Prefer calling? The AI voice helpdesk creates a ticket automatically from your call.
      </p>
    </Sheet>
  );
}

export function PostNoticeSheet({ onClose }) {
  const A = useActions();
  const [tab, setTab] = useState("notice");
  const [f, setF] = useState({ title: "", body: "", kind: "notice", priority: "normal", pinned: false });
  const [poll, setPoll] = useState({ question: "", options: ["", ""], days: 7 });
  const u = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [err, setErr] = useState("");
  const { add, say } = useApp();
  const { me } = useApp();

  return (
    <Sheet title={tab === "notice" ? "Post a notice" : "Create a poll"} onClose={onClose}>
      <Segmented value={tab} onChange={setTab} options={[{ value: "notice", label: "Notice" }, { value: "poll", label: "Poll" }]} />
      {tab === "notice" ? (
        <>
          <Input label="Title" value={f.title} onChange={(e) => { u("title", e.target.value); setErr(""); }} placeholder="e.g. Lift maintenance on Sunday" />
          <TextArea label="Details" value={f.body} onChange={(e) => u("body", e.target.value)} placeholder="Write the notice…" />
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Select label="Type" value={f.kind} onChange={(e) => u("kind", e.target.value)}
                options={[{ value: "notice", label: "📋 Notice" }, { value: "event", label: "🎉 Event" }, { value: "payment", label: "💰 Payment" }, { value: "alert", label: "🚨 Alert" }]} />
            </div>
            <div style={{ flex: 1 }}>
              <Select label="Priority" value={f.priority} onChange={(e) => u("priority", e.target.value)}
                options={[{ value: "normal", label: "Normal" }, { value: "high", label: "Urgent" }]} />
            </div>
          </div>
          {err && <p className="err" style={{ marginBottom: 10 }}>{err}</p>}
          <Btn block icon={Icons.Send} onClick={() => {
            if (!f.title.trim() || !f.body.trim()) return setErr("Title and details are both needed");
            A.postNotice(f);
            onClose();
          }}>Publish to all residents</Btn>
        </>
      ) : (
        <>
          <Input label="Question" value={poll.question} onChange={(e) => { setPoll((p) => ({ ...p, question: e.target.value })); setErr(""); }} placeholder="e.g. Should we install EV chargers?" />
          {poll.options.map((o, i) => (
            <Input key={i} label={`Option ${i + 1}`} value={o} placeholder="Answer choice"
              onChange={(e) => setPoll((p) => ({ ...p, options: p.options.map((x, j) => (j === i ? e.target.value : x)) }))} />
          ))}
          <button className="dashed" style={{ marginBottom: 13 }} onClick={() => setPoll((p) => ({ ...p, options: [...p.options, ""] }))}>+ Add option</button>
          <Input label="Open for (days)" type="number" value={poll.days} onChange={(e) => setPoll((p) => ({ ...p, days: e.target.value }))} />
          {err && <p className="err" style={{ marginBottom: 10 }}>{err}</p>}
          <Btn block icon={Icons.Poll} onClick={() => {
            const opts = poll.options.map((t) => t.trim()).filter(Boolean);
            if (!poll.question.trim() || opts.length < 2) return setErr("Add a question and at least two options");
            add("polls", {
              question: poll.question.trim(), createdBy: me.id, at: new Date().toISOString(),
              closesAt: new Date(Date.now() + Number(poll.days || 7) * 864e5).toISOString(),
              options: opts.map((t, i) => ({ id: `o${i}`, text: t, votes: 0 })), voters: {},
            });
            say("Poll published ✓");
            onClose();
          }}>Publish poll</Btn>
        </>
      )}
    </Sheet>
  );
}

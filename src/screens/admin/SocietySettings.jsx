import { useState } from "react";
import Icons from "../../icons";
import { Badge, Btn, Sheet, Input, Toggle, Alert, Empty, Select } from "../../components/ui";
import { useApp } from "../../store";
import { inr } from "../../lib/format";

const FEATURES = [
  { key: "biometric", label: "Biometric staff entry", desc: "Fingerprint and face recognition on every gate device" },
  { key: "qrSelfCheckin", label: "QR self check-in", desc: "Deliveries check themselves in at guardless gates" },
  { key: "walkieTalkie", label: "Walkie-talkie", desc: "All gate devices on one channel, transmissions recorded" },
  { key: "overstayAlarm", label: "Delivery overstay alarm", desc: "Alerts when someone stays inside past the limit" },
  { key: "smartwatch", label: "Smartwatch approvals", desc: "Approve visitors from Android and iOS watches" },
  { key: "aiHelpdesk", label: "AI voice helpdesk", desc: "Calls transcribed into tickets automatically" },
];

export default function SocietySettings() {
  const { db, setSettings, setColl, say, logAudit, can } = useApp();
  const s = db.settings;
  const [edit, setEdit] = useState(null);
  const [head, setHead] = useState(null);

  const save = (changes, what) => {
    setSettings(changes);
    logAudit("settings.update", what, JSON.stringify(changes));
    say("Settings updated ✓");
    setEdit(null);
  };

  const readOnly = !can("settings.view") && !can("*");

  return (
    <>
      <div className="card">
        <div className="row">
          <div className="grow">
            <p className="h3">{s.societyName}</p>
            <p className="tiny" style={{ marginTop: 3 }}>{s.address}</p>
            <p className="tiny" style={{ marginTop: 2 }}>Reg. {s.regNo}</p>
          </div>
          <Btn size="sm" variant="ghost" icon={Icons.Edit} onClick={() => setEdit("profile")}>Edit</Btn>
        </div>
      </div>

      <div className="sect"><h2 className="h2">Gate devices</h2></div>
      <div className="list">
        {db.gates.map((g) => (
          <div key={g.id} className="li">
            <div className="ico-tile"><Icons.Gate size={18} /></div>
            <div className="grow">
              <p className="h4">{g.name}</p>
              <p className="tiny" style={{ marginTop: 2 }}>{g.device}</p>
              <div className="wrap" style={{ marginTop: 5 }}>
                {g.features.map((f) => <Badge key={f} color="brand">{f}</Badge>)}
              </div>
            </div>
            <Badge color={g.status === "online" ? "green" : "red"}>{g.status}</Badge>
          </div>
        ))}
      </div>
      <p className="hint">Three devices are provisioned for this society from day one — main gate, service gate and clubhouse.</p>

      <div className="sect"><h2 className="h2">Features</h2></div>
      <div className="card">
        {FEATURES.map((f, i) => (
          <div key={f.key} style={i ? { borderTop: "1px solid var(--line)" } : undefined}>
            <Toggle on={!!s.features[f.key]} label={f.label} desc={f.desc}
              onChange={(v) => { setSettings({ features: { ...s.features, [f.key]: v } }); logAudit("settings.feature", f.label, v ? "enabled" : "disabled"); }} />
          </div>
        ))}
      </div>

      <div className="sect">
        <h2 className="h2">Billing rules</h2>
        <Btn size="sm" variant="ghost" icon={Icons.Edit} onClick={() => setEdit("billing")}>Edit</Btn>
      </div>
      <div className="card">
        <div className="row"><span className="muted">Late fee</span><b>{s.lateFeePct}% per cycle</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Grace period</span><b>{s.gracePeriodDays} days</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Settlement window</span><b>{s.settlementMins} minutes</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Financial year</span><b>{s.finYear}</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">GSTIN</span><b className="mono">{s.gstin}</b></div>
      </div>

      <div className="sect">
        <h2 className="h2">Charge heads</h2>
        <Badge color="brand">{db.heads.length} heads</Badge>
      </div>
      <div className="list">
        {db.heads.map((h) => (
          <div key={h.id} className="li tap" onClick={() => setHead(h)}>
            <div className="ico-tile"><Icons.Rupee size={17} /></div>
            <div className="grow">
              <p className="h4">{h.name}</p>
              <p className="tiny" style={{ marginTop: 2 }}>
                {h.basis === "per_sqft" ? `${inr(h.rate)}/sqft` : h.basis === "per_slot" ? `${inr(h.rate)} per parking slot` : h.basis === "tenant_only" ? `${inr(h.rate)} — tenanted flats only` : `${inr(h.rate)} flat rate`}
                {h.gst ? ` · GST ${h.gst}%` : ""}
              </p>
            </div>
            <Icons.Edit size={15} style={{ color: "var(--ink3)" }} />
          </div>
        ))}
      </div>
      <p className="hint">Heads combine per-sqft, flat-rate, per-slot and occupancy-based rules — the combinations cover the usual society billing structures.</p>

      <div className="sect"><h2 className="h2">Helpdesk SLA</h2></div>
      <div className="card">
        <div className="row"><span className="muted">High priority</span><b>{s.slaHours.high} hours</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Medium priority</span><b>{s.slaHours.medium} hours</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Low priority</span><b>{s.slaHours.low} hours</b></div>
      </div>

      <div className="sect"><h2 className="h2">Society bank account</h2></div>
      <div className="card">
        <div className="row"><span className="muted">Bank</span><b>{s.bank.name}</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Account</span><b className="mono">{s.bank.account}</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">IFSC</span><b className="mono">{s.bank.ifsc}</b></div>
      </div>

      {edit === "profile" && (
        <EditSheet title="Society profile" fields={[
          { key: "societyName", label: "Society name" },
          { key: "address", label: "Address" },
          { key: "regNo", label: "Registration number" },
          { key: "gstin", label: "GSTIN" },
        ]} initial={s} onClose={() => setEdit(null)} onSave={(v) => save(v, "Society profile")} />
      )}
      {edit === "billing" && (
        <EditSheet title="Billing rules" numeric fields={[
          { key: "lateFeePct", label: "Late fee (%)" },
          { key: "gracePeriodDays", label: "Grace period (days)" },
          { key: "settlementMins", label: "Settlement window (minutes)" },
          { key: "overstayMins", label: "Delivery overstay limit (minutes)" },
        ]} initial={s} onClose={() => setEdit(null)} onSave={(v) => save(v, "Billing rules")} />
      )}
      {head && <HeadSheet h={head} onClose={() => setHead(null)} onSave={(changes) => {
        setColl("heads", (list) => list.map((x) => (x.id === head.id ? { ...x, ...changes } : x)));
        logAudit("settings.head", head.name, JSON.stringify(changes));
        say("Charge head updated — applies from the next billing run.");
        setHead(null);
      }} />}
    </>
  );
}

function EditSheet({ title, fields, initial, onClose, onSave, numeric }) {
  const [f, setF] = useState(() => Object.fromEntries(fields.map((x) => [x.key, initial[x.key]])));
  return (
    <Sheet title={title} onClose={onClose}>
      {fields.map((x) => (
        <Input key={x.key} label={x.label} type={numeric ? "number" : "text"} value={f[x.key]}
          onChange={(e) => setF((p) => ({ ...p, [x.key]: numeric ? Number(e.target.value) : e.target.value }))} />
      ))}
      <Btn block onClick={() => onSave(f)}>Save</Btn>
    </Sheet>
  );
}

function HeadSheet({ h, onClose, onSave }) {
  const [f, setF] = useState({ name: h.name, rate: h.rate, gst: h.gst, basis: h.basis });
  return (
    <Sheet title={h.name} onClose={onClose}>
      <Alert kind="warn" icon={Icons.Lock}>Changes apply to the next billing run only. Issued bills are never rewritten — the audit trail depends on it.</Alert>
      <Input label="Head name" value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} />
      <Select label="Calculation basis" value={f.basis} onChange={(e) => setF((p) => ({ ...p, basis: e.target.value }))}
        options={[
          { value: "per_sqft", label: "Per square foot of carpet area" },
          { value: "flat", label: "Flat rate per unit" },
          { value: "per_slot", label: "Per parking slot" },
          { value: "tenant_only", label: "Tenanted flats only" },
        ]} />
      <Input label="Rate (₹)" type="number" step="0.1" value={f.rate} onChange={(e) => setF((p) => ({ ...p, rate: Number(e.target.value) }))} />
      <Input label="GST (%)" type="number" value={f.gst} onChange={(e) => setF((p) => ({ ...p, gst: Number(e.target.value) }))} />
      <Btn block onClick={() => onSave(f)}>Save charge head</Btn>
    </Sheet>
  );
}

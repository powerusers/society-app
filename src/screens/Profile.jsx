import { useState } from "react";
import Icons from "../icons";
import { Badge, Btn, Avatar, Toggle, Input, Sheet, Alert, Empty } from "../components/ui";
import { useApp } from "../store";
import { fmtDate, inr } from "../lib/format";

const NOTIFY = [
  { key: "visitors", label: "Visitor approvals", desc: "Gate requests, deliveries and pre-approvals" },
  { key: "notices", label: "Notices & circulars", desc: "Committee announcements and events" },
  { key: "payments", label: "Bills & payments", desc: "Bill issued, due reminders, receipts" },
  { key: "helpdesk", label: "Helpdesk updates", desc: "Status changes on your complaints" },
  { key: "community", label: "Community & marketplace", desc: "Discussions, classifieds and polls" },
  { key: "quietHours", label: "Quiet hours (10 PM – 7 AM)", desc: "Hold non-urgent alerts overnight. Gate and SOS always ring." },
];

export default function Profile({ nav }) {
  const { db, me, sel, patch, say } = useApp();
  const [edit, setEdit] = useState(false);

  const flat = me.flat ? sel.flatByCode(me.flat) : null;
  const family = me.flat ? db.users.filter((u) => u.flat === me.flat && u.id !== me.id) : [];
  const dues = me.flat ? sel.duesOf(me.flat) : 0;

  const setNotify = (key, val) => {
    patch("users", me.id, (u) => ({ notify: { ...u.notify, [key]: val } }));
    say(val ? "Notifications on" : "Notifications off");
  };

  return (
    <>
      <div className="card center">
        <Avatar name={me.name} size="lg" />
        <p className="h3" style={{ marginTop: 10 }}>{me.name}</p>
        <p className="tiny" style={{ marginTop: 3 }}>{me.email}</p>
        <div className="wrap" style={{ justifyContent: "center", marginTop: 9 }}>
          <Badge color="brand">{me.role}</Badge>
          {me.designation && <Badge color="blue">{me.designation}</Badge>}
          {me.flat && <Badge>Flat {me.flat}</Badge>}
        </div>
        <Btn size="sm" variant="ghost" icon={Icons.Edit} style={{ marginTop: 12 }} onClick={() => setEdit(true)}>Edit details</Btn>
      </div>

      {flat && (
        <>
          <div className="sect"><h2 className="h2">Your flat</h2></div>
          <div className="card">
            <div className="row"><span className="muted">Flat</span><b>{flat.code}</b></div>
            <div className="hairline" />
            <div className="row"><span className="muted">Configuration</span><b>{flat.type} · {flat.area} sq ft</b></div>
            <div className="hairline" />
            <div className="row"><span className="muted">Occupancy</span><b style={{ textTransform: "capitalize" }}>{flat.occupancy}</b></div>
            <div className="hairline" />
            <div className="row"><span className="muted">Outstanding</span><b style={{ color: dues ? "var(--red)" : "var(--green)" }}>{inr(dues)}</b></div>
            <div className="hairline" />
            <div className="row"><span className="muted">Resident since</span><b>{fmtDate(me.joined)}</b></div>
          </div>
        </>
      )}

      {family.length > 0 && (
        <>
          <div className="sect"><h2 className="h2">Family & occupants</h2></div>
          <div className="list">
            {family.map((f) => (
              <div key={f.id} className="li">
                <Avatar name={f.name} />
                <div className="grow">
                  <p className="h4">{f.name}</p>
                  <p className="tiny" style={{ marginTop: 2 }}>{f.relation} · {f.phone}</p>
                </div>
                <Badge>{f.relation}</Badge>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="sect"><h2 className="h2">Notification controls</h2></div>
      <Alert kind="info" icon={Icons.Bell}>
        Choose exactly what reaches you. Every resident sets this for themselves — the committee cannot override it, except for emergency alerts.
      </Alert>
      <div className="card">
        {NOTIFY.map((n, i) => (
          <div key={n.key} style={i ? { borderTop: "1px solid var(--line)" } : undefined}>
            <Toggle on={!!me.notify?.[n.key]} onChange={(v) => setNotify(n.key, v)} label={n.label} desc={n.desc} />
          </div>
        ))}
      </div>

      <div className="sect"><h2 className="h2">Connected devices</h2></div>
      <div className="list">
        <div className="li">
          <div className="ico-tile"><Icons.Phone size={18} /></div>
          <div className="grow"><p className="h4">This phone</p><p className="tiny">Primary device · push enabled</p></div>
          <Badge color="green">Active</Badge>
        </div>
        <div className="li">
          <div className="ico-tile"><Icons.Watch size={18} /></div>
          <div className="grow"><p className="h4">Smartwatch approvals</p><p className="tiny">Approve visitors from the wrist — Android & iOS</p></div>
          <Badge color="brand">Paired</Badge>
        </div>
      </div>

      {edit && <EditSheet me={me} onClose={() => setEdit(false)} onSave={(f) => { patch("users", me.id, f); say("Profile updated ✓"); setEdit(false); }} />}
    </>
  );
}

function EditSheet({ me, onClose, onSave }) {
  const [f, setF] = useState({ name: me.name, phone: me.phone || "", email: me.email || "" });
  const u = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [err, setErr] = useState("");
  return (
    <Sheet title="Edit your details" onClose={onClose}>
      <Input label="Full name" value={f.name} onChange={(e) => { u("name", e.target.value); setErr(""); }} />
      <Input label="Mobile" type="tel" maxLength={10} value={f.phone} onChange={(e) => u("phone", e.target.value.replace(/\D/g, ""))} />
      <Input label="Email" type="email" value={f.email} onChange={(e) => u("email", e.target.value)} />
      {err && <p className="err" style={{ marginBottom: 10 }}>{err}</p>}
      <Btn block onClick={() => {
        if (!f.name.trim()) return setErr("Name cannot be empty");
        onSave(f);
      }}>Save changes</Btn>
    </Sheet>
  );
}

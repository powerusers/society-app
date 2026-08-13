import { useState } from "react";
import Icons from "../../icons";
import { Badge, Btn, Empty, Sheet, Segmented, Stat, Avatar, Input, Select, Alert } from "../../components/ui";
import { HelpRow } from "../../components/entities";
import { useApp } from "../../store";
import { useHelp } from "../../data/help";
import { fmtDate, dayKey, uid, iso, code6 } from "../../lib/format";

export default function StaffMgmt() {
  const { db, sel, add, patch, say, logAudit } = useApp();
  const { help, update: updateHelp } = useHelp();
  const [tab, setTab] = useState("society");
  const [sheet, setSheet] = useState(false);

  const society = db.users.filter((u) => u.role === "guard" || u.role === "staff");
  const guards = society.filter((u) => u.role === "guard");
  const todayScans = db.patrols.filter((p) => p.at.slice(0, 10) === dayKey());
  const openTickets = (id) => db.tickets.filter((t) => t.assignedTo === id && t.status !== "closed").length;

  return (
    <>
      <div className="grid3">
        <Stat value={society.length} label="On payroll" color="var(--brand)" />
        <Stat value={help.length} label="Daily help" color="var(--blue)" />
        <Stat value={help.filter((h) => h.policeVerified).length} label="Police verified" color="var(--green)" />
      </div>

      <div style={{ marginTop: 12 }}>
        <Segmented value={tab} onChange={setTab} options={[
          { value: "society", label: "Society staff" },
          { value: "help", label: "Daily help" },
          { value: "perf", label: "Guard performance" },
        ]} />
      </div>

      {tab === "society" && (
        <>
          <Btn block icon={Icons.UserPlus} style={{ marginBottom: 12 }} onClick={() => setSheet(true)}>Add a staff member</Btn>
          <div className="list">
            {society.map((u) => (
              <div key={u.id} className="li">
                <Avatar name={u.name} />
                <div className="grow">
                  <p className="h4">{u.name}</p>
                  <p className="tiny" style={{ marginTop: 2 }}>
                    {u.designation || (u.role === "guard" ? "Security guard" : "Staff")}
                    {u.gate ? ` · ${sel.gate(u.gate)?.name}` : ""}{u.shift ? ` · ${u.shift}` : ""}
                  </p>
                  <div className="wrap" style={{ marginTop: 5 }}>
                    <Badge color={u.role === "guard" ? "purple" : "blue"}>{u.role}</Badge>
                    <Badge>Since {fmtDate(u.joined)}</Badge>
                    {openTickets(u.id) > 0 && <Badge color="amber">{openTickets(u.id)} open tickets</Badge>}
                  </div>
                </div>
                <a className="x" href={`tel:${u.phone}`} aria-label="Call"><Icons.Phone size={15} /></a>
              </div>
            ))}
          </div>
          <Alert kind="info" icon={Icons.Ticket}>
            Staff get their own login and close complaint tickets directly from the app — the committee is not a message relay between residents and the plumber.
          </Alert>
        </>
      )}

      {tab === "help" && (
        <div className="list">
          {help.map((h) => (
            <HelpRow key={h.id} h={h} right={
              <button className="x" aria-label="Toggle verification"
                onClick={async () => {
                  const res = await updateHelp(h, { policeVerified: !h.policeVerified });
                  if (res.ok) say(h.policeVerified ? "Marked unverified" : "Marked police verified");
                }}
                style={h.policeVerified ? { background: "var(--green-bg)", color: "var(--green)" } : undefined}>
                <Icons.Shield size={15} />
              </button>
            } />
          ))}
          {!help.length && <Empty icon={Icons.Users} title="No daily help registered" />}
        </div>
      )}

      {tab === "perf" && (
        <>
          <Alert kind="info" icon={Icons.Trophy}>
            Patrol scans, entries verified and incidents recorded feed the guard leaderboard. Committees use it to decide monthly incentives.
          </Alert>
          <div className="list">
            {guards
              .map((g) => ({
                ...g,
                scans: todayScans.filter((p) => p.guardId === g.id).length,
                verified: db.visitors.filter((v) => v.verifiedBy === g.id).length,
                incidents: db.incidents.filter((i) => i.by === g.id).length,
              }))
              .sort((a, b) => b.scans + b.verified - (a.scans + a.verified))
              .map((g, i) => (
                <div key={g.id} className="li">
                  <div className="ico-tile" style={i === 0 ? { background: "#FFF6D8", color: "#B7791F" } : undefined}>
                    {i === 0 ? <Icons.Trophy size={18} /> : <span style={{ fontWeight: 800 }}>{i + 1}</span>}
                  </div>
                  <div className="grow">
                    <p className="h4">{g.name}</p>
                    <p className="tiny" style={{ marginTop: 2 }}>{g.shift} · {sel.gate(g.gate)?.name}</p>
                    <div className="wrap" style={{ marginTop: 5 }}>
                      <Badge color="brand">{g.scans} patrol scans</Badge>
                      <Badge color="blue">{g.verified} entries verified</Badge>
                      <Badge color="amber">{g.incidents} incidents</Badge>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </>
      )}

      {sheet && <AddStaff onClose={() => setSheet(false)} onSave={(f) => {
        /* Derived from the society, not from a fixed domain: one society's
           address does not belong on another society's staff. */
        const domain = String(db.settings.societyName || "society")
          .toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "society";
        const u = add("users", {
          id: uid("u"), ...f, status: "active", joined: iso(), notify: {},
          email: `${f.name.toLowerCase().replace(/\s+/g, ".")}@${domain}.in`,
        });
        logAudit("staff.add", u.name, f.designation || f.role);
        say(`${u.name} added with a ${f.role} login.`);
        setSheet(false);
      }} />}
    </>
  );
}

function AddStaff({ onClose, onSave }) {
  const { db } = useApp();
  const [f, setF] = useState({ name: "", role: "guard", designation: "", phone: "", gate: "gate_main", shift: "06:00 – 14:00" });
  const u = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [err, setErr] = useState("");
  return (
    <Sheet title="Add a staff member" onClose={onClose}>
      <Input label="Full name" value={f.name} onChange={(e) => { u("name", e.target.value); setErr(""); }} />
      <Select label="Role" value={f.role} onChange={(e) => u("role", e.target.value)}
        options={[{ value: "guard", label: "Security guard" }, { value: "staff", label: "Facility staff" }]} />
      {f.role === "staff" && <Input label="Designation" value={f.designation} onChange={(e) => u("designation", e.target.value)} placeholder="e.g. Electrician" />}
      {f.role === "guard" && <>
        <Select label="Posted at" value={f.gate} onChange={(e) => u("gate", e.target.value)} options={db.gates.map((g) => ({ value: g.id, label: g.name }))} />
        <Select label="Shift" value={f.shift} onChange={(e) => u("shift", e.target.value)} options={["06:00 – 14:00", "14:00 – 22:00", "22:00 – 06:00"]} />
      </>}
      <Input label="Mobile" type="tel" maxLength={10} value={f.phone} onChange={(e) => u("phone", e.target.value.replace(/\D/g, ""))} />
      {err && <p className="err" style={{ marginBottom: 10 }}>{err}</p>}
      <Btn block onClick={() => {
        if (!f.name.trim()) return setErr("Enter a name");
        onSave({ ...f, name: f.name.trim() });
      }}>Create login</Btn>
    </Sheet>
  );
}

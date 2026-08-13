import { useState } from "react";
import Icons from "../../icons";
import { Badge, Btn, Empty, Sheet, Segmented, Stat, Avatar, Input, Select, Alert, SkeletonList } from "../../components/ui";
import { HelpRow } from "../../components/entities";
import { useApp } from "../../store";
import { useMembers } from "../../data/users";
import { useHelp } from "../../data/help";
import { useIncidents } from "../../data/incidents";
import { useGates } from "../../data/gates";
import { useVisitors } from "../../data/visitors";
import { fmtDate } from "../../lib/format";

const SHIFTS = ["06:00 – 14:00", "14:00 – 22:00", "22:00 – 06:00"];

export default function StaffMgmt() {
  const { db, live, say } = useApp();
  const {
    staff, loading, error, refetch, createStaff, updateStaff, setSuspended, resetPassword,
  } = useMembers();
  const { help, update: updateHelp } = useHelp();
  const { incidents } = useIncidents();
  const { gates } = useGates();
  const { visitors } = useVisitors();
  const [tab, setTab] = useState("society");
  const [sheet, setSheet] = useState(false);
  const [open, setOpen] = useState(null);
  const [secret, setSecret] = useState(null);

  const guards = staff.filter((u) => u.role === "guard");
  const openTickets = (id) => db.tickets.filter((t) => t.assignedTo === id && t.status !== "closed").length;
  /* Patrol scans are still browser-local, so in live mode there is nothing
     honest to count — the badge is left out rather than reporting zero for
     every guard on the board. */
  const patrolsKnown = !live;
  const todayScans = db.patrols.filter((p) => p.at.slice(0, 10) === new Date().toISOString().slice(0, 10));

  return (
    <>
      <div className="grid3">
        <Stat value={staff.length} label="On payroll" color="var(--brand)" />
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

      {error && (
        <Alert kind="err" icon={Icons.AlertTri}>
          {error.message}{" "}
          <button className="linkbtn" style={{ color: "inherit", textDecoration: "underline" }} onClick={refetch}>Retry</button>
        </Alert>
      )}

      {tab === "society" && (loading ? <SkeletonList rows={4} /> : (
        <>
          <Btn block icon={Icons.UserPlus} style={{ marginBottom: 12 }} onClick={() => setSheet(true)}>Add a staff member</Btn>
          <div className="list">
            {staff.map((u) => (
              <div key={u.id} className="li tap" onClick={() => setOpen(u)}
                style={u.status === "suspended" ? { opacity: 0.55 } : undefined}>
                <Avatar name={u.name} />
                <div className="grow">
                  <p className="h4">{u.name}</p>
                  <p className="tiny" style={{ marginTop: 2 }}>
                    {[u.designation || (u.role === "guard" ? "Security guard" : "Staff"), u.gateName, u.shift]
                      .filter(Boolean).join(" · ")}
                  </p>
                  <div className="wrap" style={{ marginTop: 5 }}>
                    <Badge color={u.role === "guard" ? "purple" : "blue"}>{u.role}</Badge>
                    {u.status === "suspended"
                      ? <Badge color="red">suspended</Badge>
                      : <Badge>Since {fmtDate(u.joined)}</Badge>}
                    {openTickets(u.id) > 0 && <Badge color="amber">{openTickets(u.id)} open tickets</Badge>}
                  </div>
                </div>
                {u.phone
                  ? <a className="x" href={`tel:${u.phone}`} onClick={(e) => e.stopPropagation()} aria-label="Call"><Icons.Phone size={15} /></a>
                  : <Icons.Fwd size={16} style={{ color: "var(--ink3)" }} />}
              </div>
            ))}
            {!staff.length && (
              <Empty icon={Icons.Users} title="Nobody on the payroll yet"
                note="Add your guards and facility staff — each one gets their own login, so tickets and gate entries carry a name." />
            )}
          </div>
          <Alert kind="info" icon={Icons.Ticket}>
            Staff get their own login and close complaint tickets directly from the app — the committee is not a message relay between residents and the plumber.
          </Alert>
        </>
      ))}

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
            {patrolsKnown
              ? "Patrol scans, entries verified and incidents recorded feed the guard leaderboard. Committees use it to decide monthly incentives."
              : "Entries verified and incidents recorded feed the guard leaderboard. Patrol scans join once patrolling moves off the guard's own device."}
          </Alert>
          <div className="list">
            {guards
              .map((g) => ({
                ...g,
                scans: patrolsKnown ? todayScans.filter((p) => p.guardId === g.id).length : null,
                verified: visitors.filter((v) => v.verifiedBy === g.id).length,
                incidents: incidents.filter((i) => i.by === g.id).length,
              }))
              .sort((a, b) => (b.scans || 0) + b.verified - ((a.scans || 0) + a.verified))
              .map((g, i) => (
                <div key={g.id} className="li">
                  <div className="ico-tile" style={i === 0 ? { background: "#FFF6D8", color: "#B7791F" } : undefined}>
                    {i === 0 ? <Icons.Trophy size={18} /> : <span style={{ fontWeight: 800 }}>{i + 1}</span>}
                  </div>
                  <div className="grow">
                    <p className="h4">{g.name}</p>
                    <p className="tiny" style={{ marginTop: 2 }}>{[g.shift, g.gateName].filter(Boolean).join(" · ")}</p>
                    <div className="wrap" style={{ marginTop: 5 }}>
                      {g.scans !== null && <Badge color="brand">{g.scans} patrol scans</Badge>}
                      <Badge color="blue">{g.verified} entries verified</Badge>
                      <Badge color="amber">{g.incidents} incidents</Badge>
                    </div>
                  </div>
                </div>
              ))}
            {!guards.length && <Empty icon={Icons.Shield} title="No guards on the payroll" />}
          </div>
        </>
      )}

      {sheet && (
        <AddStaff gates={gates} onClose={() => setSheet(false)} onSave={async (f) => {
          const res = await createStaff(f);
          if (res.ok) {
            setSheet(false);
            if (res.password) setSecret({ member: res.member, password: res.password, fresh: true });
          }
          return res;
        }} />
      )}

      {open && (
        <StaffSheet u={open} gates={gates} onClose={() => setOpen(null)}
          onSave={async (body) => { const r = await updateStaff(open, body); if (r.ok) setOpen({ ...open, ...body }); return r; }}
          onSuspend={async (suspended) => {
            const r = await setSuspended(open, suspended);
            if (r.ok) setOpen({ ...open, status: suspended ? "suspended" : "active" });
            return r;
          }}
          onReset={async () => {
            const r = await resetPassword(open);
            if (r.ok && r.password) { setOpen(null); setSecret({ member: open, password: r.password, fresh: false }); }
            return r;
          }} />
      )}

      {secret && <PasswordSheet {...secret} onClose={() => setSecret(null)} />}
    </>
  );
}

/**
 * The one showing of a password.
 *
 * Deliberately a whole screen rather than a toast: it appears once and there is
 * no endpoint that will repeat it, so the committee needs long enough to write
 * it down or read it out.
 */
function PasswordSheet({ member, password, fresh, onClose }) {
  return (
    <Sheet title={fresh ? "Login created" : "New password"} onClose={onClose}>
      <div className="alert warn">
        <Icons.AlertTri size={17} />
        <span className="grow">This is shown once. Nothing can read it back — a lost password means issuing another.</span>
      </div>
      <div className="card flat" style={{ marginTop: 12 }}>
        <div className="row"><span className="muted">Name</span><b>{member.name}</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Signs in with</span><b className="mono">{member.email}</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Password</span><b className="mono" style={{ letterSpacing: 1 }}>{password}</b></div>
      </div>
      <p className="hint" style={{ marginTop: 12 }}>
        Give these to {member.name} and ask them to change the password from their profile after signing in.
        {member.email.endsWith(".local") && " The address is a sign-in name, not a mailbox — nothing is sent to it."}
      </p>
      <Btn block style={{ marginTop: 14 }} onClick={onClose}>Done</Btn>
    </Sheet>
  );
}

function StaffSheet({ u, gates, onSave, onSuspend, onReset, onClose }) {
  const [f, setF] = useState({
    designation: u.designation || "", phone: u.phone || "",
    gateId: u.gateId || "", shift: u.shift || "",
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const changed = f.designation !== (u.designation || "") || f.phone !== (u.phone || "")
    || f.gateId !== (u.gateId || "") || f.shift !== (u.shift || "");

  const run = async (fn) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res?.ok === false) setErr(res.error?.message || "That did not work");
  };

  return (
    <Sheet title={u.name} onClose={onClose}>
      <div className="card flat">
        <div className="row"><span className="muted">Role</span><Badge color={u.role === "guard" ? "purple" : "blue"}>{u.role}</Badge></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Signs in with</span><b className="mono">{u.email}</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Status</span>
          <Badge color={u.status === "suspended" ? "red" : "green"}>{u.status}</Badge></div>
      </div>

      <Input label="Designation" value={f.designation} onChange={(e) => { set("designation", e.target.value); setErr(""); }}
        placeholder={u.role === "guard" ? "Security guard" : "e.g. Electrician"} />
      <Input label="Mobile" type="tel" maxLength={10} value={f.phone}
        onChange={(e) => { set("phone", e.target.value.replace(/\D/g, "")); setErr(""); }} />
      {u.role === "guard" && (
        <>
          <Select label="Posted at" value={f.gateId} onChange={(e) => set("gateId", e.target.value)}
            options={[{ value: "", label: "Not posted" }, ...gates.map((g) => ({ value: g.id, label: g.name }))]} />
          <Select label="Shift" value={f.shift} onChange={(e) => set("shift", e.target.value)}
            options={[{ value: "", label: "No fixed shift" }, ...SHIFTS.map((s) => ({ value: s, label: s }))]} />
        </>
      )}
      {err && <p className="err" style={{ marginBottom: 10 }}>{err}</p>}
      {changed && (
        <Btn block disabled={busy} onClick={() => run(() => onSave({
          designation: f.designation.trim() || null, phone: f.phone,
          gateId: f.gateId || null, shift: f.shift || null,
        }))}>{busy ? "Saving…" : "Save changes"}</Btn>
      )}

      <div className="hairline" style={{ margin: "16px 0" }} />
      <Btn block variant="ghost" icon={Icons.Lock} disabled={busy} onClick={() => run(onReset)}>
        Issue a new password
      </Btn>
      {/* Suspending rather than deleting: their tickets, gate entries and the
          incidents they recorded are the society's history, not theirs. */}
      <button className="linkbtn" style={{ marginTop: 14, color: u.status === "suspended" ? "var(--brand)" : "var(--red)" }}
        disabled={busy} onClick={() => run(() => onSuspend(u.status !== "suspended"))}>
        {u.status === "suspended" ? "Reinstate this account" : "Suspend this account"}
      </button>
    </Sheet>
  );
}

function AddStaff({ gates, onClose, onSave }) {
  const [f, setF] = useState({ name: "", role: "guard", designation: "", phone: "", email: "", gateId: "", shift: SHIFTS[0] });
  const u = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Sheet title="Add a staff member" onClose={onClose}>
      <Input label="Full name" value={f.name} onChange={(e) => { u("name", e.target.value); setErr(""); }} />
      <Select label="Role" value={f.role} onChange={(e) => u("role", e.target.value)}
        options={[{ value: "guard", label: "Security guard" }, { value: "staff", label: "Facility staff" }]} />
      {f.role === "staff" && <Input label="Designation" value={f.designation} onChange={(e) => u("designation", e.target.value)} placeholder="e.g. Electrician" />}
      {f.role === "guard" && (
        <>
          <Select label="Posted at" value={f.gateId} onChange={(e) => u("gateId", e.target.value)}
            options={[{ value: "", label: "Not posted yet" }, ...gates.map((g) => ({ value: g.id, label: g.name }))]} />
          <Select label="Shift" value={f.shift} onChange={(e) => u("shift", e.target.value)}
            options={SHIFTS.map((s) => ({ value: s, label: s }))} />
        </>
      )}
      <Input label="Mobile" type="tel" maxLength={10} value={f.phone}
        onChange={(e) => { u("phone", e.target.value.replace(/\D/g, "")); setErr(""); }} />
      {/* Optional on purpose: many guards have no work address, and refusing to
          create the account without one pushes the committee into inventing
          something worse. Left blank, the server mints a sign-in name. */}
      <Input label="Email (optional — a sign-in name is created if blank)" type="email" value={f.email}
        onChange={(e) => { u("email", e.target.value.trim()); setErr(""); }} placeholder="ramesh@example.com" />
      {err && <p className="err" style={{ marginBottom: 10 }}>{err}</p>}
      <Btn block disabled={busy} onClick={async () => {
        if (!f.name.trim()) return setErr("Enter a name");
        setBusy(true);
        const res = await onSave({
          name: f.name.trim(), role: f.role,
          designation: f.role === "staff" ? f.designation.trim() : "",
          phone: f.phone, email: f.email,
          gateId: f.role === "guard" && f.gateId ? f.gateId : null,
          shift: f.role === "guard" ? f.shift : "",
        });
        setBusy(false);
        if (res?.ok === false) setErr(res.error?.message || "Could not create that login");
      }}>{busy ? "Creating…" : "Create login"}</Btn>
    </Sheet>
  );
}

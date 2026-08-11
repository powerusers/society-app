import { useMemo, useState } from "react";
import Icons from "../icons";
import { Badge, Btn, Empty, Sheet, Input, Select, SearchBar, Segmented, Alert, Avatar, Stat } from "../components/ui";
import { HelpRow } from "../components/entities";
import QR from "../lib/qr";
import { useApp } from "../store";
import { useActions } from "../store/actions";
import { fmtDate, fmtTime, dayKey, code6, minsBetween, iso } from "../lib/format";

const ROLES = ["Maid", "Cook", "Driver", "Nanny", "Dog walker", "Newspaper", "Milkman", "Tutor", "Physiotherapist"];

export default function DailyHelp() {
  const { db, me, can, sel } = useApp();
  const [tab, setTab] = useState("mine");
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState(null);
  const [open, setOpen] = useState(null);

  const all = can("gate.view") || can("staff.manage");
  const mine = sel.helpOf(me.flat || "");

  const list = useMemo(() => {
    const base = tab === "mine" ? mine : db.dailyHelp;
    const t = q.trim().toLowerCase();
    return base.filter((h) => !t || h.name.toLowerCase().includes(t) || h.role.toLowerCase().includes(t));
  }, [tab, mine, db.dailyHelp, q]);

  return (
    <>
      {tab === "mine" && (
        <div className="grid3">
          <Stat value={mine.length} label="Your help" color="var(--brand)" />
          <Stat value={mine.filter((h) => h.status === "in").length} label="Inside now" color="var(--green)" />
          <Stat value={mine.filter((h) => h.policeVerified).length} label="Police verified" color="var(--blue)" />
        </div>
      )}

      <div style={{ display: "flex", gap: 9, margin: "12px 0" }}>
        <Btn block icon={Icons.UserPlus} onClick={() => setSheet("add")}>Add help</Btn>
        <Btn block variant="ghost" icon={Icons.Clock} onClick={() => setSheet("attendance")}>Attendance</Btn>
      </div>

      {all && (
        <Segmented value={tab} onChange={setTab} options={[
          { value: "mine", label: "My flat" }, { value: "all", label: `All (${db.dailyHelp.length})` },
        ]} />
      )}
      <SearchBar value={q} onChange={setQ} placeholder="Search by name or role…" />

      <div className="list">
        {list.map((h) => <HelpRow key={h.id} h={h} onClick={() => setOpen(h)} />)}
        {!list.length && (
          <Empty icon={Icons.Users} title="No daily help added"
            note="Add your maid, cook or driver and they get a QR staff card plus biometric entry."
            action={<Btn icon={Icons.Plus} onClick={() => setSheet("add")}>Add help</Btn>} />
        )}
      </div>

      {sheet === "add" && <AddHelpSheet onClose={() => setSheet(null)} />}
      {sheet === "attendance" && <AttendanceSheet ids={list.map((h) => h.id)} onClose={() => setSheet(null)} />}
      {open && <HelpSheet h={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function AddHelpSheet({ onClose }) {
  const { me, add, say, logAudit } = useApp();
  const [f, setF] = useState({ name: "", role: "Maid", phone: "", biometric: true, policeVerified: false });
  const u = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [err, setErr] = useState("");
  const [made, setMade] = useState(null);

  if (made) return <HelpSheet h={made} onClose={onClose} fresh />;

  return (
    <Sheet title="Add daily help" onClose={onClose}>
      <Alert kind="info">The staff member gets a QR card and, if you enable it, fingerprint entry — both included, no extra charge.</Alert>
      <Input label="Name" value={f.name} onChange={(e) => { u("name", e.target.value); setErr(""); }} placeholder="e.g. Lakshmi Bai" />
      <Select label="Role" value={f.role} onChange={(e) => u("role", e.target.value)} options={ROLES} />
      <Input label="Mobile" type="tel" value={f.phone} onChange={(e) => u("phone", e.target.value)} placeholder="10-digit number" />
      <div className="card flat" style={{ padding: "4px 14px" }}>
        <div className="row" style={{ padding: "10px 0" }}>
          <div className="grow"><p className="h4">Enrol biometric entry</p><p className="tiny">Fingerprint + face at all gates</p></div>
          <button className={`switch ${f.biometric ? "on" : ""}`} onClick={() => u("biometric", !f.biometric)}><i /></button>
        </div>
        <div className="row" style={{ padding: "10px 0", borderTop: "1px solid var(--line)" }}>
          <div className="grow"><p className="h4">Police verification done</p><p className="tiny">Committee may ask for a copy</p></div>
          <button className={`switch ${f.policeVerified ? "on" : ""}`} onClick={() => u("policeVerified", !f.policeVerified)}><i /></button>
        </div>
      </div>
      {err && <p className="err" style={{ margin: "10px 0" }}>{err}</p>}
      <Btn block icon={Icons.Plus} style={{ marginTop: 13 }} onClick={() => {
        if (!f.name.trim()) return setErr("Enter a name");
        const h = add("dailyHelp", {
          ...f, name: f.name.trim(), flats: [me.flat], cardCode: code6(), verified: true,
          rating: 5, status: "out", lastIn: null, photo: null,
        });
        logAudit("help.add", h.name, `${h.role} for ${me.flat}`);
        say("Staff card issued ✓");
        setMade(h);
      }}>Create staff card</Btn>
    </Sheet>
  );
}

function HelpSheet({ h, onClose, fresh }) {
  const { db, patch, say, can } = useApp();
  const A = useActions();
  const att = db.attendance.filter((a) => a.helpId === h.id).slice(0, 8);
  return (
    <Sheet title={fresh ? "Staff card ready" : h.name} onClose={onClose}>
      <QR value={JSON.stringify({ card: h.cardCode, name: h.name })} caption={h.cardCode} />
      <div className="card" style={{ marginTop: 16 }}>
        <div className="row"><span className="muted">Role</span><b>{h.role}</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Works at</span><b>{h.flats.join(", ")}</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Mobile</span><b>{h.phone || "—"}</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Biometric</span><Badge color={h.biometric ? "green" : ""}>{h.biometric ? "Enrolled" : "Not enrolled"}</Badge></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Police verification</span><Badge color={h.policeVerified ? "blue" : "amber"}>{h.policeVerified ? "Done" : "Pending"}</Badge></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Currently</span><Badge color={h.status === "in" ? "green" : ""}>{h.status === "in" ? `Inside since ${fmtTime(h.lastIn)}` : "Outside"}</Badge></div>
      </div>

      <p className="h4" style={{ margin: "4px 0 8px" }}>Rate this help</p>
      <div className="wrap" style={{ marginBottom: 16 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} className={`chip ${Math.round(h.rating) === n ? "on" : ""}`}
            onClick={() => { patch("dailyHelp", h.id, { rating: n }); say("Rating saved — visible to other flats"); }}>
            {"★".repeat(n)}
          </button>
        ))}
      </div>

      <p className="h4" style={{ marginBottom: 8 }}>Recent attendance</p>
      <div className="list">
        {att.map((a) => (
          <div key={a.id} className="li">
            <div className="ico-tile"><Icons.Clock size={17} /></div>
            <div className="grow">
              <p className="h4">{fmtDate(a.date)}</p>
              <p className="tiny" style={{ marginTop: 2 }}>
                In {fmtTime(a.inAt)}{a.outAt ? ` · Out ${fmtTime(a.outAt)} · ${minsBetween(a.inAt, a.outAt)} min` : " · still inside"}
              </p>
            </div>
            <Badge color={a.mode === "biometric" ? "brand" : "blue"}>{a.mode}</Badge>
          </div>
        ))}
        {!att.length && <Empty icon={Icons.Clock} title="No attendance recorded yet" />}
      </div>

      {can("gate.operate") && (
        <Btn block style={{ marginTop: 12 }} onClick={() => { A.markHelp(h, h.status === "in" ? "out" : "in"); onClose(); }}>
          {h.status === "in" ? "Check out" : "Check in"}
        </Btn>
      )}
    </Sheet>
  );
}

function AttendanceSheet({ ids, onClose }) {
  const { db, sel } = useApp();
  const rows = db.attendance.filter((a) => ids.includes(a.helpId)).slice(0, 40);
  const byDay = rows.reduce((m, a) => { (m[a.date] ||= []).push(a); return m; }, {});
  return (
    <Sheet title="Attendance register" onClose={onClose}>
      {Object.entries(byDay).sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([d, list]) => (
        <div key={d} style={{ marginBottom: 14 }}>
          <p className="h4" style={{ marginBottom: 7 }}>{d === dayKey() ? "Today" : fmtDate(d)}</p>
          <div className="list">
            {list.map((a) => {
              const h = db.dailyHelp.find((x) => x.id === a.helpId);
              return (
                <div key={a.id} className="li">
                  <Avatar name={h?.name || "?"} />
                  <div className="grow">
                    <p className="h4">{h?.name}</p>
                    <p className="tiny" style={{ marginTop: 2 }}>{h?.role} · {sel.gate(a.gateId)?.name}</p>
                  </div>
                  <div className="right">
                    <p className="tiny">In {fmtTime(a.inAt)}</p>
                    <p className="tiny">{a.outAt ? `Out ${fmtTime(a.outAt)}` : "inside"}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {!rows.length && <Empty icon={Icons.Clock} title="No attendance yet" />}
    </Sheet>
  );
}

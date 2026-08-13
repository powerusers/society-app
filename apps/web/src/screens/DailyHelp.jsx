import { useMemo, useState } from "react";
import Icons from "../icons";
import { Badge, Btn, Empty, Sheet, Input, Select, SearchBar, Segmented, Alert, Avatar, Stat, SkeletonList } from "../components/ui";
import { HelpRow } from "../components/entities";
import QR from "../lib/qr";
import { HELP_ROLES } from "@gvs/shared";
import { useApp } from "../store";
import { useHelp } from "../data/help";
import { fmtDate, fmtTime, dayKey, minsBetween } from "../lib/format";

export default function DailyHelp() {
  const { me, can } = useApp();
  const repo = useHelp();
  const { help, mine, scope, attendance, loading, error, refetch, add, attach, detach, rate, check } = repo;
  const [tab, setTab] = useState("mine");
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState(null);
  const [openId, setOpenId] = useState(null);

  const all = scope === "society";
  /* Rendered from the list rather than the row that opened it, so a rating or a
     check-in shows up without closing and reopening the sheet. */
  const open = openId ? help.find((h) => h.id === openId) : null;

  const list = useMemo(() => {
    const base = tab === "mine" ? mine : help;
    const t = q.trim().toLowerCase();
    return base.filter((h) => !t || h.name.toLowerCase().includes(t) || h.role.toLowerCase().includes(t));
  }, [tab, mine, help, q]);

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
        {/* Help is registered against a flat, so this is offered to someone who
            has one — or to the committee, who add staff on residents' behalf. */}
        {(me.flat || can("staff.manage")) && (
          <Btn block icon={Icons.UserPlus} onClick={() => setSheet("add")}>Add help</Btn>
        )}
        <Btn block variant="ghost" icon={Icons.Clock} onClick={() => setSheet("attendance")}>Attendance</Btn>
      </div>

      {all && (
        <Segmented value={tab} onChange={setTab} options={[
          { value: "mine", label: "My flat" }, { value: "all", label: `All (${help.length})` },
        ]} />
      )}
      <SearchBar value={q} onChange={setQ} placeholder="Search by name or role…" />

      {error && (
        <Alert kind="err" icon={Icons.AlertTri}>
          {error.message}{" "}
          <button className="linkbtn" style={{ color: "inherit", textDecoration: "underline" }} onClick={refetch}>Retry</button>
        </Alert>
      )}

      {loading ? <SkeletonList rows={4} /> : (
        <div className="list">
          {list.map((h) => <HelpRow key={h.id} h={h} onClick={() => setOpenId(h.id)} />)}
          {!list.length && (
            <Empty icon={Icons.Users} title="No daily help added"
              note="Add your maid, cook or driver and they get a QR staff card plus biometric entry."
              action={<Btn icon={Icons.Plus} onClick={() => setSheet("add")}>Add help</Btn>} />
          )}
        </div>
      )}

      {sheet === "add" && (
        <AddHelpSheet canVerify={can("staff.manage")} onAdd={add} onClose={() => setSheet(null)} />
      )}
      {sheet === "attendance" && (
        <AttendanceSheet rows={attendance.filter((a) => list.some((h) => h.id === a.helpId))} onClose={() => setSheet(null)} />
      )}
      {open && (
        <HelpSheet h={open} attendance={attendance.filter((a) => a.helpId === open.id).slice(0, 8)}
          canCheck={can("gate.operate")} onRate={rate} onCheck={check}
          onAttach={attach} onDetach={async (h) => { const r = await detach(h); if (r.ok) setOpenId(null); }}
          onClose={() => setOpenId(null)} />
      )}
    </>
  );
}

function AddHelpSheet({ canVerify, onAdd, onClose }) {
  const [f, setF] = useState({ name: "", role: "Maid", phone: "", biometric: true, policeVerified: false });
  const u = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState(null);

  /* The card is issued by the server, so this shows the one that exists rather
     than a code the browser invented and hoped was unique. */
  if (made) return <CardSheet h={made} onClose={onClose} />;

  return (
    <Sheet title="Add daily help" onClose={onClose}>
      <Alert kind="info">The staff member gets a QR card and, if you enable it, fingerprint entry — both included, no extra charge.</Alert>
      <Input label="Name" value={f.name} onChange={(e) => { u("name", e.target.value); setErr(""); }} placeholder="e.g. Lakshmi Bai" />
      <Select label="Role" value={f.role} onChange={(e) => u("role", e.target.value)} options={HELP_ROLES} />
      <Input label="Mobile" type="tel" value={f.phone} onChange={(e) => { u("phone", e.target.value); setErr(""); }} placeholder="10-digit number" />
      <div className="card flat" style={{ padding: "4px 14px" }}>
        <div className="row" style={{ padding: "10px 0" }}>
          <div className="grow"><p className="h4">Enrol biometric entry</p><p className="tiny">Fingerprint + face at all gates</p></div>
          <button className={`switch ${f.biometric ? "on" : ""}`} onClick={() => u("biometric", !f.biometric)}><i /></button>
        </div>
        {/* Only the committee records police verification: a household ticking
            its own box would make the badge every other flat reads worthless. */}
        {canVerify && (
          <div className="row" style={{ padding: "10px 0", borderTop: "1px solid var(--line)" }}>
            <div className="grow"><p className="h4">Police verification done</p><p className="tiny">Committee may ask for a copy</p></div>
            <button className={`switch ${f.policeVerified ? "on" : ""}`} onClick={() => u("policeVerified", !f.policeVerified)}><i /></button>
          </div>
        )}
      </div>
      {err && <p className="err" style={{ margin: "10px 0" }}>{err}</p>}
      <Btn block icon={Icons.Plus} style={{ marginTop: 13 }} disabled={busy} onClick={async () => {
        if (!f.name.trim()) return setErr("Enter a name");
        setBusy(true);
        const res = await onAdd({
          name: f.name.trim(), role: f.role, phone: f.phone.trim(),
          biometric: f.biometric, policeVerified: canVerify ? f.policeVerified : false,
        });
        setBusy(false);
        if (res?.ok === false) return setErr(res.error?.message || "Could not issue a staff card");
        setMade(res.help);
      }}>{busy ? "Issuing…" : "Create staff card"}</Btn>
    </Sheet>
  );
}

function CardSheet({ h, onClose }) {
  return (
    <Sheet title="Staff card ready" onClose={onClose}>
      <QR value={JSON.stringify({ card: h.cardCode, name: h.name })} caption={h.cardCode} />
      <p className="muted center" style={{ marginTop: 14 }}>
        {h.name} can now be checked in at any gate with this card{h.biometric ? ", or with their fingerprint once enrolled at the desk" : ""}.
      </p>
      <Btn block style={{ marginTop: 16 }} onClick={onClose}>Done</Btn>
    </Sheet>
  );
}

function HelpSheet({ h, attendance, canCheck, onRate, onCheck, onAttach, onDetach, onClose }) {
  const [busy, setBusy] = useState(false);

  return (
    <Sheet title={h.name} onClose={onClose}>
      <QR value={JSON.stringify({ card: h.cardCode, name: h.name })} caption={h.cardCode} />
      <div className="card" style={{ marginTop: 16 }}>
        <div className="row"><span className="muted">Role</span><b>{h.role}</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Works at</span><b>{h.flats.join(", ") || "—"}</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Mobile</span><b>{h.phone || "—"}</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Biometric</span><Badge color={h.biometric ? "green" : ""}>{h.biometric ? "Enrolled" : "Not enrolled"}</Badge></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Police verification</span><Badge color={h.policeVerified ? "blue" : "amber"}>{h.policeVerified ? "Done" : "Pending"}</Badge></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Currently</span><Badge color={h.status === "in" ? "green" : ""}>{h.status === "in" ? `Inside since ${fmtTime(h.lastIn)}` : "Outside"}</Badge></div>
      </div>

      {/* An average of the households who employ them, with how many said so —
          one flat's five is not a settled reputation, and the old screen let
          whichever flat rated last replace everyone else's opinion. */}
      <div className="row" style={{ margin: "4px 0 8px" }}>
        <p className="h4">Rate this help</p>
        <span className="tiny">
          {h.raters ? `${h.rating} from ${h.raters} flat${h.raters === 1 ? "" : "s"}` : "Not rated yet"}
        </span>
      </div>
      {h.mine ? (
        <div className="wrap" style={{ marginBottom: 16 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} className={`chip ${h.myRating === n ? "on" : ""}`} onClick={() => onRate(h, n)}>
              {"★".repeat(n)}
            </button>
          ))}
        </div>
      ) : (
        <p className="hint" style={{ marginBottom: 16 }}>Only a flat they work at can rate them.</p>
      )}

      <p className="h4" style={{ marginBottom: 8 }}>Recent attendance</p>
      <div className="list">
        {attendance.map((a) => (
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
        {!attendance.length && <Empty icon={Icons.Clock} title="No attendance recorded yet" />}
      </div>

      {canCheck && (
        <Btn block style={{ marginTop: 12 }} disabled={busy} onClick={async () => {
          setBusy(true);
          await onCheck(h, h.status === "in" ? "out" : "in");
          setBusy(false);
        }}>
          {h.status === "in" ? "Check out" : "Check in"}
        </Btn>
      )}

      {/* Taking someone on who already works elsewhere in the society keeps one
          card for one person — adding them again would give the gate two
          records for the same human being. */}
      {h.mine ? (
        <button className="linkbtn" style={{ marginTop: 14, color: "var(--red)" }} onClick={() => onDetach(h)}>
          Remove from my flat
        </button>
      ) : (
        <Btn block variant="ghost" style={{ marginTop: 10 }} icon={Icons.UserPlus} onClick={() => onAttach(h)}>
          They work at my flat too
        </Btn>
      )}
    </Sheet>
  );
}

function AttendanceSheet({ rows, onClose }) {
  const byDay = rows.reduce((m, a) => { (m[a.date] ||= []).push(a); return m; }, {});
  return (
    <Sheet title="Attendance register" onClose={onClose}>
      {Object.entries(byDay).sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([d, list]) => (
        <div key={d} style={{ marginBottom: 14 }}>
          <p className="h4" style={{ marginBottom: 7 }}>{d === dayKey() ? "Today" : fmtDate(d)}</p>
          <div className="list">
            {list.map((a) => (
              <div key={a.id} className="li">
                <Avatar name={a.helpName || "?"} />
                <div className="grow">
                  <p className="h4">{a.helpName}</p>
                  <p className="tiny" style={{ marginTop: 2 }}>{[a.helpRole, a.gateName].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="right">
                  <p className="tiny">In {fmtTime(a.inAt)}</p>
                  <p className="tiny">{a.outAt ? `Out ${fmtTime(a.outAt)}` : "inside"}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {!rows.length && <Empty icon={Icons.Clock} title="No attendance yet" />}
    </Sheet>
  );
}

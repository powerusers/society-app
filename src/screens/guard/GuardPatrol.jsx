import { useState } from "react";
import Icons from "../../icons";
import { Badge, Btn, Stat, Alert, Sheet, TextArea, Empty } from "../../components/ui";
import QR from "../../lib/qr";
import { useApp } from "../../store";
import { useActions } from "../../store/actions";
import { ago, fmtTime, dayKey, minsBetween } from "../../lib/format";

const ROUND_MINS = 120; // a checkpoint is "due" this long after its last scan

export default function GuardPatrol() {
  const { db, me, sel } = useApp();
  const A = useActions();
  const [open, setOpen] = useState(null);

  const lastScan = (cpId) => db.patrols.filter((p) => p.checkpointId === cpId).sort((a, b) => (a.at < b.at ? 1 : -1))[0];
  const due = db.checkpoints.filter((c) => {
    const l = lastScan(c.id);
    return !l || minsBetween(l.at) > ROUND_MINS;
  });
  const todayScans = db.patrols.filter((p) => p.at.slice(0, 10) === dayKey());
  const mine = todayScans.filter((p) => p.guardId === me.id);

  const board = ["u_grd", "u_grd2", "u_grd3"]
    .map((id) => ({ id, name: sel.userName(id), scans: todayScans.filter((p) => p.guardId === id).length }))
    .sort((a, b) => b.scans - a.scans);

  return (
    <>
      <div className="grid3">
        <Stat value={todayScans.length} label="Scans today" color="var(--brand)" />
        <Stat value={mine.length} label="Yours" color="var(--green)" />
        <Stat value={due.length} label="Due now" color={due.length ? "var(--red)" : "var(--ink3)"} />
      </div>

      {due.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Alert kind="warn" icon={Icons.Route}>
            <b>{due.length} checkpoint{due.length > 1 ? "s" : ""} overdue.</b> Each point is expected to be scanned every {ROUND_MINS / 60} hours.
          </Alert>
        </div>
      )}

      <div className="sect"><h2 className="h2">Checkpoints</h2></div>
      <div className="list">
        {db.checkpoints.map((c) => {
          const l = lastScan(c.id);
          const overdue = !l || minsBetween(l.at) > ROUND_MINS;
          return (
            <div key={c.id} className="li tap" onClick={() => setOpen(c)}>
              <div className="ico-tile" style={overdue ? { background: "var(--amber-bg)", color: "var(--amber)" } : undefined}>
                <Icons.Pin size={19} />
              </div>
              <div className="grow">
                <p className="h4">{c.name}</p>
                <p className="tiny" style={{ marginTop: 2 }}>
                  {c.zone} · {l ? `last scanned ${ago(l.at)} by ${sel.userName(l.guardId)}` : "never scanned"}
                </p>
              </div>
              <Badge color={overdue ? "amber" : "green"}>{overdue ? "Due" : "OK"}</Badge>
            </div>
          );
        })}
      </div>

      <div className="sect"><h2 className="h2">Guard leaderboard · today</h2></div>
      <div className="list">
        {board.map((g, i) => (
          <div key={g.id} className="li">
            <div className="ico-tile" style={i === 0 ? { background: "#FFF6D8", color: "#B7791F" } : undefined}>
              {i === 0 ? <Icons.Trophy size={19} /> : <span style={{ fontWeight: 800 }}>{i + 1}</span>}
            </div>
            <div className="grow">
              <p className="h4">{g.name}{g.id === me.id ? " (you)" : ""}</p>
              <p className="tiny" style={{ marginTop: 2 }}>{g.scans} checkpoint scans</p>
            </div>
            <Badge color={i === 0 ? "amber" : ""}>{i === 0 ? "Top guard" : `${g.scans} pts`}</Badge>
          </div>
        ))}
      </div>

      <div className="sect"><h2 className="h2">Recent rounds</h2></div>
      <div className="list">
        {db.patrols.slice(0, 12).map((p) => {
          const cp = db.checkpoints.find((c) => c.id === p.checkpointId);
          return (
            <div key={p.id} className="li">
              <div className="ico-tile"><Icons.Route size={18} /></div>
              <div className="grow">
                <p className="h4">{cp?.name || "Checkpoint"}</p>
                <p className="tiny" style={{ marginTop: 2 }}>
                  {sel.userName(p.guardId)} · {fmtTime(p.at)} · geo {p.geo.lat.toFixed(4)}, {p.geo.lng.toFixed(4)}
                </p>
              </div>
              <span className="tiny">{ago(p.at)}</span>
            </div>
          );
        })}
        {!db.patrols.length && <Empty icon={Icons.Route} title="No rounds logged yet" />}
      </div>

      {open && <ScanCheckpoint cp={open} onClose={() => setOpen(null)} onScan={(note) => { A.logPatrol(open.id, note); setOpen(null); }} />}
    </>
  );
}

function ScanCheckpoint({ cp, onClose, onScan }) {
  const [note, setNote] = useState("");
  return (
    <Sheet title={cp.name} onClose={onClose}>
      <QR value={cp.qr} caption={cp.qr} />
      <p className="muted center" style={{ margin: "14px 0" }}>
        Scan the QR sticker fixed at this checkpoint. The app records your GPS position with the scan, so the round cannot be logged from anywhere else.
      </p>
      <TextArea label="Observation (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Basement light flickering near slot 42" />
      <Btn block icon={Icons.Check} onClick={() => onScan(note)}>Log checkpoint scan</Btn>
    </Sheet>
  );
}

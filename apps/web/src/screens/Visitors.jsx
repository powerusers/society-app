import { useMemo, useState } from "react";
import Icons from "../icons";
import { Badge, Btn, Empty, Segmented, Stat, Alert, Sheet, TextArea } from "../components/ui";
import { VisitorCard, ApproveDeny, CatTile, overstay } from "../components/entities";
import { PreApproveSheet, GatePassSheet } from "../components/sheets";
import { useApp } from "../store";
import { useActions } from "../store/actions";
import { fmtDateTime, ago } from "../lib/format";

export default function Visitors({ nav }) {
  const { db, me, can, sel } = useApp();
  const A = useActions();
  const [tab, setTab] = useState("live");
  const [sheet, setSheet] = useState(null);
  const [deny, setDeny] = useState(null);

  const scope = can("gate.view") ? db.visitors : db.visitors.filter((v) => v.flatCode === me.flat);
  const pending = scope.filter((v) => v.status === "pending");
  const upcoming = scope.filter((v) => v.status === "pre-approved" || v.status === "approved");
  const inside = scope.filter((v) => v.status === "inside");
  const history = scope.filter((v) => v.status === "exited" || v.status === "denied");
  const alarms = inside.filter((v) => overstay(v, db.settings.overstayMins)?.over);

  return (
    <>
      <div className="grid3">
        <Stat value={pending.length} label="Awaiting you" color="var(--amber)" />
        <Stat value={inside.length} label="Inside now" color="var(--green)" />
        <Stat value={upcoming.length} label="Expected" color="var(--blue)" />
      </div>

      <div style={{ display: "flex", gap: 9, margin: "12px 0" }}>
        <Btn block icon={Icons.UserPlus} onClick={() => setSheet("pre")}>Pre-approve</Btn>
        <Btn block variant="ghost" icon={Icons.Users} onClick={() => nav.go("dailyHelp")}>Daily help</Btn>
      </div>

      {alarms.length > 0 && (
        <Alert kind="err" icon={Icons.AlertTri}>
          <b>Overstay alarm:</b> {alarms.map((v) => v.name).join(", ")} {alarms.length > 1 ? "have" : "has"} exceeded the {db.settings.overstayMins}-minute in-building limit. The gate and the guard have been alerted.
        </Alert>
      )}

      <Segmented value={tab} onChange={setTab} options={[
        { value: "live", label: `Live${pending.length ? ` (${pending.length})` : ""}` },
        { value: "expected", label: "Expected" },
        { value: "history", label: "History" },
      ]} />

      {tab === "live" && (
        <>
          {pending.map((v) => (
            <VisitorCard key={v.id} v={v} accent="#FF9800"
              actions={<ApproveDeny onApprove={() => A.approveVisitor(v)} onDeny={() => setDeny(v)} />} />
          ))}
          {inside.map((v) => (
            <VisitorCard key={v.id} v={v} accent="#43A047"
              actions={can("gate.operate") ? <Btn size="sm" variant="ghost" icon={Icons.LogOut} onClick={() => A.exitVisitor(v)}>Mark exit</Btn> : null} />
          ))}
          {!pending.length && !inside.length && (
            <Empty icon={Icons.Gate} title="Nothing at the gate right now"
              note="Approvals, deliveries and staff entries will show up here in real time." />
          )}
        </>
      )}

      {tab === "expected" && (
        <>
          {upcoming.map((v) => (
            <VisitorCard key={v.id} v={v} accent="#1565C0"
              actions={<>
                {v.passCode && <Btn size="sm" variant="ghost" icon={Icons.QR} onClick={() => setSheet(v)}>Show pass</Btn>}
                <Btn size="sm" variant="danger" icon={Icons.X} onClick={() => setDeny(v)}>Cancel</Btn>
              </>} />
          ))}
          {!upcoming.length && <Empty icon={Icons.Calendar} title="No expected visitors"
            action={<Btn icon={Icons.Plus} onClick={() => setSheet("pre")}>Pre-approve someone</Btn>} />}
        </>
      )}

      {tab === "history" && (
        <div className="list">
          {history.slice(0, 40).map((v) => (
            <div key={v.id} className="li">
              <CatTile category={v.category} />
              <div className="grow">
                <p className="h4 truncate">{v.name}</p>
                <p className="tiny" style={{ marginTop: 2 }}>
                  {v.flatCode} · {sel.gate(v.gateId)?.name} · {fmtDateTime(v.entryAt || v.createdAt)}
                </p>
              </div>
              <Badge color={v.status === "denied" ? "red" : ""}>{v.status}</Badge>
            </div>
          ))}
          {!history.length && <Empty icon={Icons.Clock} title="No past entries yet" />}
        </div>
      )}

      {sheet === "pre" && <PreApproveSheet onClose={() => setSheet(null)} />}
      {sheet && typeof sheet === "object" && <GatePassSheet visitor={sheet} onClose={() => setSheet(null)} />}
      {deny && <DenySheet v={deny} onClose={() => setDeny(null)} onDeny={(r) => A.denyVisitor(deny, r)} />}
    </>
  );
}

function DenySheet({ v, onClose, onDeny }) {
  const [reason, setReason] = useState("");
  const QUICK = ["Not expected", "Wrong flat", "Ask them to wait outside", "Leave at the gate", "Come back later"];
  return (
    <Sheet title={`Deny ${v.name}?`} onClose={onClose}>
      <p className="muted" style={{ marginBottom: 12 }}>The guard sees your reason instantly on the gate device.</p>
      <div className="wrap" style={{ marginBottom: 12 }}>
        {QUICK.map((q) => <button key={q} className={`chip ${reason === q ? "on" : ""}`} onClick={() => setReason(q)}>{q}</button>)}
      </div>
      <TextArea label="Message to the guard (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div style={{ display: "flex", gap: 9 }}>
        <Btn variant="ghost" block onClick={onClose}>Cancel</Btn>
        <Btn variant="danger" block onClick={() => { onDeny(reason); onClose(); }}>Deny entry</Btn>
      </div>
    </Sheet>
  );
}

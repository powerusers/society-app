import { useMemo, useState } from "react";
import Icons from "../../icons";
import { Badge, Btn, Empty, Sheet, Segmented, SearchBar, Stat, Alert, Confirm, Select } from "../../components/ui";
import { useApp } from "../../store";
import { useActions } from "../../store/actions";
import { inr, lakh, cycleLabel, fmtDate, thisCycle, shiftCycle, pct, csv, download } from "../../lib/format";

export default function Billing() {
  const { db, me, can, sel, say, setColl, logAudit } = useApp();
  const A = useActions();
  const [cycle, setCycle] = useState(thisCycle());
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [open, setOpen] = useState(null);

  const cycles = useMemo(() => {
    const set = new Set(db.bills.map((b) => b.cycle));
    set.add(thisCycle()); set.add(shiftCycle(thisCycle(), 1));
    return [...set].sort().reverse();
  }, [db.bills]);

  const runBills = db.bills.filter((b) => b.cycle === cycle);
  const drafts = runBills.filter((b) => b.status === "pending-approval");
  const issued = runBills.filter((b) => b.status !== "pending-approval");
  const paid = runBills.filter((b) => b.status === "paid");
  const overdue = runBills.filter((b) => b.status === "overdue");
  const billedAmt = runBills.reduce((s, b) => s + b.total, 0);
  const collectedAmt = paid.reduce((s, b) => s + b.total, 0);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return runBills
      .filter((b) => (tab === "all" ? true : tab === "unpaid" ? b.status !== "paid" : b.status === tab))
      .filter((b) => !t || b.flatCode.toLowerCase().includes(t))
      .sort((a, b) => a.flatCode.localeCompare(b.flatCode));
  }, [runBills, tab, q]);

  const isMaker = can("billing.make");
  // Separation of duties: whoever prepared the run cannot also approve it.
  const preparedByMe = drafts.length > 0 && drafts[0].makerId === me.id;
  const isChecker = can("billing.approve") && !preparedByMe;

  const applyLateFees = () => {
    let n = 0;
    setColl("bills", (all) => all.map((b) => {
      if (b.cycle !== cycle || b.status !== "issued" || new Date(b.dueDate) >= new Date() || b.lateFee) return b;
      n++;
      const fee = Math.round((b.total * db.settings.lateFeePct) / 100);
      return { ...b, lateFee: fee, total: b.total + fee, status: "overdue" };
    }));
    logAudit("billing.latefee", `Run ${cycle}`, `${db.settings.lateFeePct}% applied`);
    say(n ? `Late fee applied to ${n} bills.` : "No bills are past their due date.", n ? "ok" : "bad");
  };

  const exportRun = () => {
    const head = ["Flat", "Cycle", "Subtotal", "GST", "Late fee", "Total", "Status", "Due date", "Receipt"];
    const rows = list.map((b) => {
      const p = sel.paymentOf(b.id);
      return [b.flatCode, cycleLabel(b.cycle), b.subtotal, b.gst, b.lateFee, b.total, b.status, b.dueDate, p?.receiptNo || ""];
    });
    download(`billing-${cycle}.csv`, csv([head, ...rows]));
  };

  return (
    <>
      <Select label="Billing cycle" value={cycle} onChange={(e) => setCycle(e.target.value)}
        options={cycles.map((c) => ({ value: c, label: cycleLabel(c) }))} />

      <div className="grid3">
        <Stat value={runBills.length} label="Bills" color="var(--brand)" />
        <Stat value={`${pct(collectedAmt, billedAmt)}%`} label="Collected" color="var(--green)" />
        <Stat value={overdue.length} label="Overdue" color={overdue.length ? "var(--red)" : "var(--ink3)"} />
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row">
          <div><p className="tiny">Billed</p><p className="h3">{lakh(billedAmt)}</p></div>
          <div className="right"><p className="tiny">Collected</p><p className="h3" style={{ color: "var(--green)" }}>{lakh(collectedAmt)}</p></div>
        </div>
        <div className="bar" style={{ marginTop: 10 }}><i style={{ width: `${pct(collectedAmt, billedAmt)}%` }} /></div>
      </div>

      {/* maker-checker */}
      {drafts.length > 0 ? (
        <>
          <Alert kind="warn" icon={Icons.Lock}>
            <b>{drafts.length} draft bills are waiting for approval.</b> Prepared by {sel.userName(drafts[0].makerId)}. No bill reaches a resident until the treasurer approves this run.
          </Alert>
          {isChecker ? (
            <div style={{ display: "flex", gap: 9, marginBottom: 12 }}>
              <Btn block icon={Icons.Check} onClick={() => setConfirm("approve")}>Approve & issue</Btn>
              <Btn block variant="danger" icon={Icons.X} onClick={() => setConfirm("reject")}>Reject run</Btn>
            </div>
          ) : (
            <p className="hint" style={{ marginBottom: 12 }}>
              {preparedByMe
                ? "You prepared this run, so you cannot approve it. Another committee member with approval rights has to sign off — the maker is never the checker."
                : "Approval rights sit with the treasurer and the secretary."}
            </p>
          )}
        </>
      ) : (
        isMaker && runBills.length === 0 && (
          <>
            <Alert kind="info" icon={Icons.Doc}>
              No bills exist for {cycleLabel(cycle)}. Generating creates one draft bill per flat from the charge heads, then sends the run for approval.
            </Alert>
            <Btn block icon={Icons.Plus} style={{ marginBottom: 12 }} onClick={() => A.generateBills(cycle)}>
              Generate {db.flats.length} bills for {cycleLabel(cycle)}
            </Btn>
          </>
        )
      )}

      <div style={{ display: "flex", gap: 9, marginBottom: 12, flexWrap: "wrap" }}>
        <Btn size="sm" variant="ghost" icon={Icons.Download} onClick={exportRun}>Export CSV</Btn>
        {isChecker && <Btn size="sm" variant="ghost" icon={Icons.Alert} onClick={applyLateFees}>Apply late fees</Btn>}
        <Btn size="sm" variant="ghost" icon={Icons.Send} onClick={() => say(`Reminder sent to ${runBills.filter((b) => b.status !== "paid").length} flats.`)}>Send reminders</Btn>
      </div>

      <SearchBar value={q} onChange={setQ} placeholder="Search flat…" />
      <Segmented value={tab} onChange={setTab} options={[
        { value: "all", label: `All (${runBills.length})` },
        { value: "unpaid", label: `Unpaid (${runBills.length - paid.length})` },
        { value: "overdue", label: `Overdue (${overdue.length})` },
      ]} />

      <div className="list">
        {list.slice(0, 60).map((b) => (
          <div key={b.id} className="li tap" onClick={() => setOpen(b)}>
            <div className="ico-tile"><Icons.Doc size={17} /></div>
            <div className="grow">
              <p className="h4">Flat {b.flatCode}</p>
              <p className="tiny" style={{ marginTop: 2 }}>Due {fmtDate(b.dueDate)}{b.lateFee ? ` · late fee ${inr(b.lateFee)}` : ""}</p>
            </div>
            <div className="right">
              <p className="h4">{inr(b.total)}</p>
              <Badge color={b.status === "paid" ? "green" : b.status === "overdue" ? "red" : b.status === "pending-approval" ? "purple" : "amber"}>{b.status}</Badge>
            </div>
          </div>
        ))}
        {!list.length && <Empty icon={Icons.Doc} title="No bills in this view" />}
      </div>
      {list.length > 60 && <p className="hint center">Showing 60 of {list.length} — search by flat to narrow down.</p>}

      {confirm === "approve" && (
        <Confirm title={`Approve ${drafts.length} bills?`}
          body={`Total value ${inr(drafts.reduce((s, b) => s + b.total, 0))}. Once approved, bills are issued to residents and the run is locked in the audit trail under your name.`}
          confirmLabel="Approve & issue" onConfirm={() => A.approveRun(cycle)} onClose={() => setConfirm(null)} />
      )}
      {confirm === "reject" && (
        <Confirm title="Reject this draft run?" danger confirmLabel="Reject run"
          body="All draft bills for this cycle are discarded. The maker can regenerate after fixing the charge heads."
          onConfirm={() => A.rejectRun(cycle, "Rejected by checker")} onClose={() => setConfirm(null)} />
      )}
      {open && <BillDetail b={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function BillDetail({ b, onClose }) {
  const { sel } = useApp();
  const p = sel.paymentOf(b.id);
  const flat = sel.flatByCode(b.flatCode);
  const residents = sel.residentsOf(b.flatCode);
  return (
    <Sheet title={`Flat ${b.flatCode} · ${cycleLabel(b.cycle)}`} onClose={onClose}>
      <div className="wrap" style={{ marginBottom: 12 }}>
        <Badge color={b.status === "paid" ? "green" : "amber"}>{b.status}</Badge>
        {flat && <Badge>{flat.type} · {flat.area} sqft</Badge>}
        <Badge>{residents[0]?.name || "—"}</Badge>
      </div>
      <table className="tbl">
        <thead><tr><th>Head</th><th className="right">Amount</th><th className="right">GST</th></tr></thead>
        <tbody>
          {b.items.map((i) => <tr key={i.headId}><td>{i.name}</td><td className="right">{inr(i.amount)}</td><td className="right">{i.gst ? inr(i.gst) : "—"}</td></tr>)}
          {b.lateFee > 0 && <tr><td style={{ color: "var(--red)" }}>Late fee</td><td className="right">{inr(b.lateFee)}</td><td className="right">—</td></tr>}
        </tbody>
      </table>
      <div className="hairline" />
      <div className="row"><span className="h3">Total</span><span className="h2">{inr(b.total)}</span></div>
      <div className="card flat" style={{ marginTop: 14 }}>
        <div className="row"><span className="muted">Prepared by</span><b>{sel.userName(b.makerId)}</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Approved by</span><b>{b.approvedBy ? sel.userName(b.approvedBy) : "Pending"}</b></div>
        {p && <>
          <div className="hairline" />
          <div className="row"><span className="muted">Receipt</span><b>{p.receiptNo}</b></div>
          <div className="hairline" />
          <div className="row"><span className="muted">Narration</span><b className="mono" style={{ fontSize: 11 }}>{p.narration}</b></div>
        </>}
      </div>
    </Sheet>
  );
}

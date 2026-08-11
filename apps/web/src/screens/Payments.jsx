import { useEffect, useState } from "react";
import Icons from "../icons";
import { Badge, Btn, Empty, Sheet, Segmented, Alert, Stat, useTick, SkeletonList } from "../components/ui";
import { BillRow } from "../components/entities";
import { useApp } from "../store";
import { useMyBills } from "../data/bills";
import { inr, cycleLabel, fmtDate, fmtDateTime, until, csv, download, minsBetween } from "../lib/format";

const MODES = [
  { id: "UPI", label: "UPI", icon: Icons.Zap, note: "Zero convenience fee" },
  { id: "NetBanking", label: "Net banking", icon: Icons.Bank, note: "All major banks" },
  { id: "Card", label: "Debit / credit card", icon: Icons.Card, note: "0.4% gateway fee" },
  { id: "NEFT", label: "NEFT / RTGS", icon: Icons.Doc, note: "Use the deposit slip" },
];

export default function Payments() {
  const { db, me, live } = useApp();
  const { bills, loading, error, refetch, pay, paymentFor, dues } = useMyBills();
  const [tab, setTab] = useState("due");
  const [open, setOpen] = useState(null);
  const [payTarget, setPayTarget] = useState(null);
  const [recent, setRecent] = useState(null);

  const due = bills.filter((b) => b.status !== "paid");
  const paid = bills.filter((b) => b.status === "paid");

  const exportStatement = () => {
    const head = ["Cycle", "Amount", "Status", "Due date"];
    download(`${me.flat}-statement.csv`,
      csv([head, ...bills.map((b) => [cycleLabel(b.cycle), b.total, b.status, b.dueDate])]));
  };

  return (
    <>
      <div className={`card ${dues ? "" : "brand"}`}
        style={dues ? { background: "var(--warn-bg)", borderColor: "var(--warn-border)" } : undefined}>
        <div className="row top">
          <div className="grow">
            <p className="tiny" style={{ color: dues ? "var(--warn)" : undefined, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>
              {dues ? "Outstanding" : "All clear"}
            </p>
            <p className="h1" style={{ marginTop: 4, color: dues ? "var(--warn)" : "#fff" }}>{inr(dues)}</p>
            {due[0] && <p className="tiny" style={{ marginTop: 5 }}>Next due {fmtDate(due[0].dueDate)} · {cycleLabel(due[0].cycle)}</p>}
            {!dues && <p className="sub" style={{ marginTop: 5, fontSize: 12.5 }}>No pending maintenance for {me.flat}.</p>}
          </div>
          {due[0] && <Btn onClick={() => setPayTarget(due[0])}>Pay now</Btn>}
        </div>
      </div>

      {recent && <SettlementTracker p={recent} />}

      <div className="grid3">
        <Stat value={paid.length} label="Bills paid" color="var(--ok)" />
        <Stat value={due.length} label="Pending" color={due.length ? "var(--warn)" : "var(--ink-4)"} />
        <Stat value={`${db.settings.lateFeePct}%`} label="Late fee" color="var(--bad)" />
      </div>

      <Btn block variant="ghost" icon={Icons.Download} style={{ margin: "12px 0" }} onClick={exportStatement}>
        Download statement
      </Btn>

      {error && (
        <Alert kind="err" icon={Icons.AlertTri}>
          {error.message} <button className="linkbtn" style={{ color: "inherit", textDecoration: "underline" }} onClick={refetch}>Retry</button>
        </Alert>
      )}

      <Alert kind="ok" icon={Icons.Zap}>
        Payments settle to the society's bank account within {db.settings.settlementMins} minutes, and your flat number appears in the bank narration — so the treasurer never has to guess who paid.
      </Alert>

      <Segmented value={tab} onChange={setTab} options={[
        { value: "due", label: `Due (${due.length})` },
        { value: "paid", label: "Paid" },
      ]} />

      {loading ? <SkeletonList rows={3} /> : (
        <div className="list">
          {(tab === "due" ? due : paid).map((b) => <BillRow key={b.id} b={b} onOpen={() => setOpen(b)} />)}
          {tab === "due" && !due.length && <Empty icon={Icons.CheckCircle} title="Nothing due" note="Every bill for your flat is settled." />}
          {tab === "paid" && !paid.length && <Empty icon={Icons.Doc} title="No paid bills yet" />}
        </div>
      )}

      {open && (
        <BillSheet b={open} paymentFor={paymentFor} onClose={() => setOpen(null)}
          onPay={() => { setPayTarget(open); setOpen(null); }} />
      )}
      {payTarget && (
        <PaySheet b={payTarget} pay={pay} onClose={() => setPayTarget(null)}
          onPaid={(p) => { setRecent(p); setPayTarget(null); }} />
      )}
    </>
  );
}

function SettlementTracker({ p }) {
  useTick(15000);
  const left = until(p.settledAt);
  const total = 30;
  const done = Math.min(100, Math.max(0, ((total - Math.round(left.ms / 60000)) / total) * 100));
  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 9 }}>
        <div className="grow">
          <p className="h4">Settling to the society account</p>
          <p className="tiny" style={{ marginTop: 3 }}>{p.receiptNo} · {inr(p.amount)} · {p.mode}</p>
        </div>
        <Badge color="blue">{left.late ? "Settled" : `~${left.txt} left`}</Badge>
      </div>
      <div className="bar"><i style={{ width: `${done}%`, background: "var(--info)" }} /></div>
      <p className="tiny mono" style={{ marginTop: 9 }}>{p.narration}</p>
    </div>
  );
}

function BillSheet({ b, paymentFor, onClose, onPay }) {
  const { db } = useApp();
  const [payment, setPayment] = useState(null);

  useEffect(() => {
    let alive = true;
    if (b.status === "paid") Promise.resolve(paymentFor(b)).then((p) => alive && setPayment(p)).catch(() => {});
    return () => { alive = false; };
  }, [b, paymentFor]);

  return (
    <Sheet title={`Bill · ${cycleLabel(b.cycle)}`} onClose={onClose}>
      <div className="wrap" style={{ marginBottom: 14 }}>
        <Badge color={b.status === "paid" ? "green" : b.status === "overdue" ? "red" : "amber"}>{b.status}</Badge>
        <Badge>Flat {b.flatCode}</Badge>
        <Badge>Due {fmtDate(b.dueDate)}</Badge>
      </div>
      <table className="tbl">
        <thead><tr><th>Head</th><th className="right">Amount</th><th className="right">GST</th></tr></thead>
        <tbody>
          {b.items.map((i) => (
            <tr key={i.headId}>
              <td>{i.name}</td>
              <td className="right">{inr(i.amount)}</td>
              <td className="right">{i.gst ? inr(i.gst) : "—"}</td>
            </tr>
          ))}
          {b.lateFee > 0 && <tr><td style={{ color: "var(--bad)" }}>Late payment fee</td><td className="right" style={{ color: "var(--bad)" }}>{inr(b.lateFee)}</td><td className="right">—</td></tr>}
        </tbody>
      </table>
      <div className="hairline" />
      <div className="row"><span className="muted">Subtotal</span><b>{inr(b.subtotal)}</b></div>
      <div className="row" style={{ marginTop: 6 }}><span className="muted">GST</span><b>{inr(b.gst)}</b></div>
      <div className="row" style={{ marginTop: 12 }}><span className="h3">Total</span><span className="h1" style={{ fontSize: 20 }}>{inr(b.total)}</span></div>

      {b.status === "paid" ? (
        <div className="alert ok" style={{ marginTop: 16 }}>
          <Icons.CheckCircle size={17} />
          <span className="grow">
            {payment
              ? <>Paid {fmtDateTime(payment.paidAt)} via {payment.mode}. Receipt <b>{payment.receiptNo}</b>, settled in {minsBetween(payment.paidAt, payment.settledAt)} minutes.</>
              : "Paid."}
          </span>
        </div>
      ) : (
        <Btn block style={{ marginTop: 16 }} icon={Icons.Rupee} onClick={onPay}>Pay {inr(b.total)}</Btn>
      )}
      <p className="hint" style={{ marginTop: 12 }}>
        Society GSTIN {db.settings.gstin} · {db.settings.bank?.name} · A/c ••••{String(db.settings.bank?.account || "").slice(-4)}
      </p>
    </Sheet>
  );
}

function PaySheet({ b, pay, onClose, onPaid }) {
  const { db } = useApp();
  const [mode, setMode] = useState("UPI");
  const [state, setState] = useState("choose");
  const [receipt, setReceipt] = useState(null);
  const [err, setErr] = useState("");

  const run = async () => {
    setState("processing");
    setErr("");
    const res = await pay(b, mode);
    if (!res.ok) { setErr(res.error?.message || "Payment could not be recorded"); setState("choose"); return; }
    setReceipt(res.payment);
    setState("done");
  };

  if (state === "done" && receipt) {
    return (
      <Sheet title="Payment successful" onClose={() => { onPaid(receipt); onClose(); }}>
        <div className="center" style={{ padding: "8px 0 20px" }}>
          <Icons.CheckCircle size={54} style={{ color: "var(--ok)" }} />
          <p className="h1" style={{ marginTop: 14 }}>{inr(receipt.amount)}</p>
          <p className="muted" style={{ marginTop: 4 }}>paid for {cycleLabel(b.cycle)}</p>
        </div>
        <div className="card flat">
          <div className="row"><span className="muted">Receipt</span><b>{receipt.receiptNo}</b></div>
          <div className="hairline" />
          <div className="row"><span className="muted">Transaction</span><b className="mono">{receipt.txnId}</b></div>
          <div className="hairline" />
          <div className="row"><span className="muted">Mode</span><b>{receipt.mode}</b></div>
          <div className="hairline" />
          <div className="row"><span className="muted">Narration</span><b className="mono" style={{ fontSize: 11 }}>{receipt.narration}</b></div>
        </div>
        <Alert kind="ok" icon={Icons.Zap}>
          Funds reach the society account by {new Date(receipt.settledAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} — within {db.settings.settlementMins} minutes.
        </Alert>
        <Btn block onClick={() => { onPaid(receipt); onClose(); }}>Done</Btn>
      </Sheet>
    );
  }

  return (
    <Sheet title={`Pay ${inr(b.total)}`} onClose={onClose}>
      <div className="card flat">
        <div className="row"><span className="muted">Bill</span><b>{cycleLabel(b.cycle)} · {b.flatCode}</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Due date</span><b>{fmtDate(b.dueDate)}</b></div>
        <div className="hairline" />
        <div className="row"><span className="h4">Payable</span><span className="h3">{inr(b.total)}</span></div>
      </div>
      <p className="h4" style={{ margin: "4px 0 10px" }}>Choose a payment mode</p>
      <div className="list">
        {MODES.map((m) => (
          <div key={m.id} className="li tap" onClick={() => setMode(m.id)}>
            <div className="ico-tile" style={mode === m.id ? { background: "var(--accent)", color: "#fff" } : undefined}>
              <m.icon size={17} />
            </div>
            <div className="grow">
              <p className="h4">{m.label}</p>
              <p className="tiny" style={{ marginTop: 3 }}>{m.note}</p>
            </div>
            {mode === m.id ? <Icons.CheckCircle size={18} style={{ color: "var(--accent)" }} /> : <span style={{ width: 18 }} />}
          </div>
        ))}
      </div>
      {err && <p className="err" style={{ marginBottom: 10 }}>{err}</p>}
      <Btn block style={{ marginTop: 12 }} disabled={state === "processing"} icon={state === "processing" ? undefined : Icons.Lock} onClick={run}>
        {state === "processing" ? "Recording…" : `Pay ${inr(b.total)}`}
      </Btn>
      <p className="hint center" style={{ marginTop: 10 }}>
        No payment gateway is connected yet — this records the receipt and the ledger entry. Online collection arrives in phase 2.
      </p>
    </Sheet>
  );
}

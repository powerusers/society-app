import { useState } from "react";
import Icons from "../icons";
import { Badge, Btn, Empty, Sheet, Segmented, Alert, Stat, useTick } from "../components/ui";
import { BillRow } from "../components/entities";
import { useApp } from "../store";
import { useActions } from "../store/actions";
import { inr, cycleLabel, fmtDate, fmtDateTime, until, csv, download, minsBetween } from "../lib/format";

const MODES = [
  { id: "UPI", label: "UPI", icon: Icons.Zap, note: "Zero convenience fee" },
  { id: "NetBanking", label: "Net banking", icon: Icons.Bank, note: "All major banks" },
  { id: "Card", label: "Debit / credit card", icon: Icons.Card, note: "0.4% gateway fee" },
  { id: "NEFT", label: "NEFT / RTGS", icon: Icons.Doc, note: "Use the deposit slip" },
];

export default function Payments() {
  const { db, me, sel } = useApp();
  const [tab, setTab] = useState("due");
  const [open, setOpen] = useState(null);
  const [pay, setPay] = useState(null);

  const flat = me.flat;
  const bills = sel.billsOf(flat);
  const due = bills.filter((b) => b.status !== "paid");
  const paid = bills.filter((b) => b.status === "paid");
  const dues = due.reduce((s, b) => s + b.total, 0);
  const myPayments = db.payments.filter((p) => p.flatCode === flat).sort((a, b) => (a.paidAt < b.paidAt ? 1 : -1));
  const settling = myPayments.filter((p) => new Date(p.settledAt) > new Date());

  const exportLedger = () => {
    const head = ["Cycle", "Bill", "Amount", "Status", "Due date", "Paid on", "Receipt", "Mode"];
    const rows = bills.map((b) => {
      const p = sel.paymentOf(b.id);
      return [cycleLabel(b.cycle), b.id, b.total, b.status, b.dueDate, p ? fmtDate(p.paidAt) : "", p?.receiptNo || "", p?.mode || ""];
    });
    download(`${flat}-statement.csv`, csv([head, ...rows]));
  };

  return (
    <>
      <div className={`card ${dues ? "" : "brand"}`} style={dues ? { background: "linear-gradient(135deg,#FFF8E1,#FFF3E0)", borderColor: "#FFE0B2" } : undefined}>
        <div className="row top">
          <div className="grow">
            <p className="tiny" style={{ color: dues ? "var(--amber)" : undefined, fontWeight: 700 }}>{dues ? "Outstanding" : "All clear"}</p>
            <p className="num" style={{ fontSize: 30, color: dues ? "#BF360C" : "#fff" }}>{inr(dues)}</p>
            {due[0] && <p className="tiny" style={{ marginTop: 4 }}>Next due {fmtDate(due[0].dueDate)} · {cycleLabel(due[0].cycle)}</p>}
            {!dues && <p className="sub" style={{ marginTop: 4 }}>No pending maintenance for {flat}.</p>}
          </div>
          {due[0] && <Btn onClick={() => setPay(due[0])}>Pay now</Btn>}
        </div>
      </div>

      {settling.length > 0 && settling.map((p) => <SettlementTracker key={p.id} p={p} />)}

      <div className="grid3">
        <Stat value={paid.length} label="Bills paid" color="var(--green)" />
        <Stat value={due.length} label="Pending" color={due.length ? "var(--amber)" : "var(--ink3)"} />
        <Stat value={db.settings.lateFeePct + "%"} label="Late fee" color="var(--red)" />
      </div>

      <div style={{ display: "flex", gap: 9, margin: "12px 0" }}>
        <Btn block variant="ghost" icon={Icons.Download} onClick={exportLedger}>Download statement</Btn>
      </div>

      <Alert kind="ok" icon={Icons.Zap}>
        Payments settle to the society's bank account within {db.settings.settlementMins} minutes, and your flat number appears in the bank narration — so the treasurer never has to guess who paid.
      </Alert>

      <Segmented value={tab} onChange={setTab} options={[
        { value: "due", label: `Due (${due.length})` },
        { value: "paid", label: "Paid" },
        { value: "receipts", label: "Receipts" },
      ]} />

      {tab === "due" && (
        <div className="list">
          {due.map((b) => <BillRow key={b.id} b={b} onOpen={() => setOpen(b)} />)}
          {!due.length && <Empty icon={Icons.CheckCircle} title="Nothing due" note="Every bill for your flat is settled." />}
        </div>
      )}

      {tab === "paid" && (
        <div className="list">
          {paid.map((b) => <BillRow key={b.id} b={b} onOpen={() => setOpen(b)} />)}
          {!paid.length && <Empty icon={Icons.Doc} title="No paid bills yet" />}
        </div>
      )}

      {tab === "receipts" && (
        <div className="list">
          {myPayments.map((p) => (
            <div key={p.id} className="li">
              <div className="ico-tile"><Icons.Doc size={18} /></div>
              <div className="grow">
                <p className="h4">{p.receiptNo}</p>
                <p className="tiny" style={{ marginTop: 2 }}>{fmtDateTime(p.paidAt)} · {p.mode} · {p.txnId}</p>
                <p className="tiny mono" style={{ marginTop: 2 }}>{p.narration}</p>
              </div>
              <div className="right">
                <p className="h4">{inr(p.amount)}</p>
                <Badge color={p.reconciled ? "green" : "amber"}>{p.reconciled ? "Reconciled" : "Settling"}</Badge>
              </div>
            </div>
          ))}
          {!myPayments.length && <Empty icon={Icons.Doc} title="No receipts yet" />}
        </div>
      )}

      {open && <BillSheet b={open} onClose={() => setOpen(null)} onPay={() => { setOpen(null); setPay(open); }} />}
      {pay && <PaySheet b={pay} onClose={() => setPay(null)} />}
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
      <div className="row" style={{ marginBottom: 8 }}>
        <div className="grow">
          <p className="h4">Settling to the society account</p>
          <p className="tiny" style={{ marginTop: 2 }}>{p.receiptNo} · {inr(p.amount)} · {p.mode}</p>
        </div>
        <Badge color="blue">{left.late ? "Settled" : `~${left.txt} left`}</Badge>
      </div>
      <div className="bar"><i style={{ width: `${done}%`, background: "var(--blue)" }} /></div>
      <p className="tiny mono" style={{ marginTop: 8 }}>{p.narration}</p>
    </div>
  );
}

function BillSheet({ b, onClose, onPay }) {
  const { db, sel } = useApp();
  const p = sel.paymentOf(b.id);
  return (
    <Sheet title={`Bill · ${cycleLabel(b.cycle)}`} onClose={onClose}>
      <div className="wrap" style={{ marginBottom: 12 }}>
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
          {b.lateFee > 0 && <tr><td style={{ color: "var(--red)" }}>Late payment fee</td><td className="right" style={{ color: "var(--red)" }}>{inr(b.lateFee)}</td><td className="right">—</td></tr>}
        </tbody>
      </table>
      <div className="hairline" />
      <div className="row"><span className="muted">Subtotal</span><b>{inr(b.subtotal)}</b></div>
      <div className="row" style={{ marginTop: 6 }}><span className="muted">GST</span><b>{inr(b.gst)}</b></div>
      <div className="row" style={{ marginTop: 10 }}><span className="h3">Total</span><span className="h2">{inr(b.total)}</span></div>

      {p ? (
        <div className="alert ok" style={{ marginTop: 16 }}>
          <Icons.CheckCircle size={17} />
          <span className="grow">Paid {fmtDateTime(p.paidAt)} via {p.mode}. Receipt <b>{p.receiptNo}</b>, settled to the society account in {minsBetween(p.paidAt, p.settledAt)} minutes.</span>
        </div>
      ) : (
        <Btn block style={{ marginTop: 16 }} icon={Icons.Rupee} onClick={onPay}>Pay {inr(b.total)}</Btn>
      )}
      <p className="hint" style={{ marginTop: 12 }}>
        Society GSTIN {db.settings.gstin} · Bank {db.settings.bank.name} · A/c ••••{db.settings.bank.account.slice(-4)}
      </p>
    </Sheet>
  );
}

function PaySheet({ b, onClose }) {
  const { db } = useApp();
  const A = useActions();
  const [mode, setMode] = useState("UPI");
  const [state, setState] = useState("choose");
  const [receipt, setReceipt] = useState(null);

  const run = () => {
    setState("processing");
    setTimeout(() => {
      const p = A.payBill(b, mode);
      setReceipt(p);
      setState("done");
    }, 1200);
  };

  if (state === "done" && receipt) {
    return (
      <Sheet title="Payment successful" onClose={onClose}>
        <div className="center" style={{ padding: "10px 0 18px" }}>
          <Icons.CheckCircle size={58} style={{ color: "var(--green)" }} />
          <p className="h1" style={{ marginTop: 12 }}>{inr(receipt.amount)}</p>
          <p className="muted">paid for {cycleLabel(b.cycle)}</p>
        </div>
        <div className="card flat">
          <div className="row"><span className="muted">Receipt</span><b>{receipt.receiptNo}</b></div>
          <div className="hairline" />
          <div className="row"><span className="muted">Transaction</span><b className="mono">{receipt.txnId}</b></div>
          <div className="hairline" />
          <div className="row"><span className="muted">Mode</span><b>{receipt.mode}</b></div>
          <div className="hairline" />
          <div className="row"><span className="muted">Bank narration</span><b className="mono" style={{ fontSize: 11 }}>{receipt.narration}</b></div>
        </div>
        <Alert kind="ok" icon={Icons.Zap}>
          Funds reach the society account by {new Date(receipt.settledAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} — within {db.settings.settlementMins} minutes, not the 2–3 days other platforms take.
        </Alert>
        <Btn block onClick={onClose}>Done</Btn>
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
      <p className="h4" style={{ margin: "6px 0 9px" }}>Choose a payment mode</p>
      <div className="list">
        {MODES.map((m) => (
          <div key={m.id} className="li tap" onClick={() => setMode(m.id)}>
            <div className="ico-tile" style={mode === m.id ? { background: "var(--brand)", color: "#fff" } : undefined}><m.icon size={18} /></div>
            <div className="grow">
              <p className="h4">{m.label}</p>
              <p className="tiny" style={{ marginTop: 2 }}>{m.note}</p>
            </div>
            {mode === m.id ? <Icons.CheckCircle size={19} style={{ color: "var(--brand)" }} /> : <span style={{ width: 19 }} />}
          </div>
        ))}
      </div>
      <Btn block style={{ marginTop: 12 }} disabled={state === "processing"} icon={state === "processing" ? undefined : Icons.Lock} onClick={run}>
        {state === "processing" ? "Processing…" : `Pay ${inr(b.total)} securely`}
      </Btn>
      <p className="hint center" style={{ marginTop: 10 }}>Demo build — no real gateway is called and no money moves.</p>
    </Sheet>
  );
}

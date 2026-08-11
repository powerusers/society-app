import { useMemo, useState } from "react";
import Icons from "../../icons";
import { Badge, Btn, Empty, Sheet, Stat, Segmented, SearchBar, Input, Select, TextArea } from "../../components/ui";
import { useApp } from "../../store";
import { useActions } from "../../store/actions";
import { inr, lakh, fmtDate, dayKey, csv, download, thisCycle, cycleLabel } from "../../lib/format";

const EXPENSE_HEADS = ["Security agency", "Housekeeping", "Common electricity", "Water tanker", "Lift AMC",
  "Garden & landscaping", "STP maintenance", "Generator diesel", "Pest control", "Accounting & audit",
  "Repairs — plumbing", "Repairs — civil", "Festival & events", "Bank charges", "Other"];

export default function Ledger() {
  const { db, can } = useApp();
  const A = useActions();
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [cycle, setCycle] = useState(thisCycle());
  const [sheet, setSheet] = useState(false);

  const cycles = useMemo(() => [...new Set(db.ledger.map((l) => l.date.slice(0, 7)))].sort().reverse(), [db.ledger]);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return db.ledger
      .filter((l) => l.date.slice(0, 7) === cycle)
      .filter((l) => (tab === "all" ? true : l.type === tab))
      .filter((l) => !t || l.head.toLowerCase().includes(t) || (l.flatCode || "").toLowerCase().includes(t))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [db.ledger, cycle, tab, q]);

  const income = rows.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0);
  const expense = rows.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0);
  const tds = rows.reduce((s, r) => s + (r.tds || 0), 0);

  const exportLedger = () => {
    const head = ["Date", "Head", "Type", "Amount", "Flat", "Mode", "TDS", "Note"];
    download(`ledger-${cycle}.csv`, csv([head, ...rows.map((r) => [fmtDate(r.date), r.head, r.type, r.amount, r.flatCode || "", r.mode || "", r.tds || 0, r.note || ""])]));
  };

  return (
    <>
      <Select label="Period" value={cycle} onChange={(e) => setCycle(e.target.value)}
        options={cycles.map((c) => ({ value: c, label: cycleLabel(c) }))} />

      <div className="grid3">
        <Stat value={lakh(income)} label="Income" color="var(--green)" />
        <Stat value={lakh(expense)} label="Expense" color="var(--red)" />
        <Stat value={lakh(income - expense)} label="Surplus" color={income - expense >= 0 ? "var(--brand)" : "var(--red)"} />
      </div>

      {tds > 0 && <p className="hint" style={{ marginTop: 8 }}>TDS deducted this period: <b>{inr(tds)}</b> — included in the Form 26Q export under Reports.</p>}

      <div style={{ display: "flex", gap: 9, margin: "12px 0", flexWrap: "wrap" }}>
        {can("accounts.write") && <Btn size="sm" icon={Icons.Plus} onClick={() => setSheet(true)}>Add entry</Btn>}
        <Btn size="sm" variant="ghost" icon={Icons.Download} onClick={exportLedger}>Export CSV</Btn>
      </div>

      <SearchBar value={q} onChange={setQ} placeholder="Search head or flat…" />
      <Segmented value={tab} onChange={setTab} options={[
        { value: "all", label: "All" }, { value: "income", label: "Income" }, { value: "expense", label: "Expense" },
      ]} />

      <div className="list">
        {rows.slice(0, 60).map((r) => (
          <div key={r.id} className="li">
            <div className="ico-tile" style={{ background: r.type === "income" ? "var(--green-bg)" : "var(--red-bg)", color: r.type === "income" ? "var(--green)" : "var(--red)" }}>
              {r.type === "income" ? <Icons.Down size={17} /> : <Icons.Up size={17} />}
            </div>
            <div className="grow">
              <p className="h4">{r.head}</p>
              <p className="tiny" style={{ marginTop: 2 }}>{fmtDate(r.date)}{r.flatCode ? ` · ${r.flatCode}` : ""}{r.mode ? ` · ${r.mode}` : ""}</p>
              {r.note && <p className="tiny" style={{ marginTop: 2 }}>{r.note}</p>}
            </div>
            <div className="right">
              <p className="h4" style={{ color: r.type === "income" ? "var(--green)" : "var(--red)" }}>
                {r.type === "income" ? "+" : "−"}{inr(r.amount)}
              </p>
              {r.tds > 0 && <Badge color="purple">TDS {inr(r.tds)}</Badge>}
            </div>
          </div>
        ))}
        {!rows.length && <Empty icon={Icons.Board} title="No entries in this period" />}
      </div>
      {rows.length > 60 && <p className="hint center">Showing 60 of {rows.length} entries.</p>}

      {sheet && <AddEntry onClose={() => setSheet(false)} onSave={(f) => { A.addLedger(f); setSheet(false); }} />}
    </>
  );
}

function AddEntry({ onClose, onSave }) {
  const [f, setF] = useState({ type: "expense", head: EXPENSE_HEADS[0], amount: "", date: dayKey(), mode: "NEFT", tds: "", note: "", vendor: "" });
  const u = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [err, setErr] = useState("");
  return (
    <Sheet title="New ledger entry" onClose={onClose}>
      <Select label="Type" value={f.type} onChange={(e) => u("type", e.target.value)}
        options={[{ value: "expense", label: "Expense" }, { value: "income", label: "Income" }]} />
      {f.type === "expense"
        ? <Select label="Head" value={f.head} onChange={(e) => u("head", e.target.value)} options={EXPENSE_HEADS} />
        : <Input label="Head" value={f.head} onChange={(e) => u("head", e.target.value)} placeholder="e.g. Interest income" />}
      <Input label="Amount (₹)" type="number" value={f.amount} onChange={(e) => { u("amount", e.target.value); setErr(""); }} />
      <Input label="Date" type="date" value={f.date} onChange={(e) => u("date", e.target.value)} />
      <Select label="Mode" value={f.mode} onChange={(e) => u("mode", e.target.value)} options={["NEFT", "UPI", "Cheque", "Cash", "RTGS"]} />
      {f.type === "expense" && <>
        <Input label="Vendor" value={f.vendor} onChange={(e) => u("vendor", e.target.value)} placeholder="e.g. Sharp Security Services" />
        <Input label="TDS deducted (₹)" type="number" value={f.tds} onChange={(e) => u("tds", e.target.value)} placeholder="0" />
      </>}
      <TextArea label="Note" value={f.note} onChange={(e) => u("note", e.target.value)} />
      {err && <p className="err" style={{ marginBottom: 10 }}>{err}</p>}
      <Btn block onClick={() => {
        if (!Number(f.amount)) return setErr("Enter an amount");
        onSave({ ...f, amount: Number(f.amount), tds: Number(f.tds || 0), date: `${f.date}T10:00:00.000Z` });
      }}>Record entry</Btn>
    </Sheet>
  );
}

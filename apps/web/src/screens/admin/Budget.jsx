import { useMemo, useState } from "react";
import Icons from "../../icons";
import { Badge, Btn, Empty, Stat, Alert, Input, Sheet } from "../../components/ui";
import { useApp } from "../../store";
import { inr, lakh, pct, csv, download } from "../../lib/format";

/** Budget vs actual for the financial year, with variance flags on every head. */
export default function Budget() {
  const { db, can, patch, say } = useApp();
  const [edit, setEdit] = useState(null);

  const fyStart = new Date(new Date().getFullYear(), 3, 1); // Indian FY starts 1 April
  const monthsElapsed = Math.max(1, Math.round((Date.now() - fyStart) / (30.4 * 864e5)));

  const rows = useMemo(() => db.budgets.map((b) => {
    const actual = db.ledger.filter((l) => l.type === "expense" && l.head === b.head).reduce((s, l) => s + l.amount, 0);
    const proRata = Math.round((b.budgeted / 12) * monthsElapsed);
    const variance = proRata - actual;
    return { ...b, actual, proRata, variance, usedPct: pct(actual, b.budgeted) };
  }).sort((a, b) => a.variance - b.variance), [db.budgets, db.ledger, monthsElapsed]);

  const budgeted = rows.reduce((s, r) => s + r.budgeted, 0);
  const actual = rows.reduce((s, r) => s + r.actual, 0);
  const proRata = rows.reduce((s, r) => s + r.proRata, 0);
  const over = rows.filter((r) => r.variance < 0);

  const exportBudget = () => {
    const head = ["Head", "Annual budget", "Pro-rata to date", "Actual", "Variance", "% used"];
    download(`budget-${db.settings.finYear}.csv`, csv([head, ...rows.map((r) => [r.head, r.budgeted, r.proRata, r.actual, r.variance, `${r.usedPct}%`])]));
  };

  return (
    <>
      <div className="grid3">
        <Stat value={lakh(budgeted)} label={`FY ${db.settings.finYear}`} color="var(--brand)" />
        <Stat value={lakh(actual)} label="Spent" color="var(--amber)" />
        <Stat value={over.length} label="Heads over" color={over.length ? "var(--red)" : "var(--green)"} />
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row" style={{ marginBottom: 8 }}>
          <div className="grow">
            <p className="h4">Spend against pro-rata budget</p>
            <p className="tiny" style={{ marginTop: 2 }}>{monthsElapsed} month{monthsElapsed > 1 ? "s" : ""} into the financial year</p>
          </div>
          <Badge color={actual <= proRata ? "green" : "red"}>{actual <= proRata ? "On track" : "Over"}</Badge>
        </div>
        <div className="bar"><i style={{ width: `${Math.min(100, pct(actual, proRata || 1))}%`, background: actual <= proRata ? "var(--green)" : "var(--red)" }} /></div>
        <div className="row" style={{ marginTop: 8 }}>
          <span className="tiny">Actual {lakh(actual)}</span>
          <span className="tiny">Pro-rata {lakh(proRata)}</span>
        </div>
      </div>

      {over.length > 0 && (
        <Alert kind="warn" icon={Icons.AlertTri}>
          <b>{over.length} head{over.length > 1 ? "s are" : " is"} running over budget.</b> The largest gap is {over[0].head} at {inr(-over[0].variance)} above pro-rata.
        </Alert>
      )}

      <Btn size="sm" variant="ghost" icon={Icons.Download} onClick={exportBudget} style={{ marginBottom: 12 }}>Export CSV</Btn>

      <div className="sect"><h2 className="h2">By head</h2></div>
      {rows.map((r) => (
        <div key={r.id} className="card">
          <div className="row" style={{ marginBottom: 8 }}>
            <div className="grow">
              <p className="h4">{r.head}</p>
              <p className="tiny" style={{ marginTop: 2 }}>Budget {lakh(r.budgeted)} · pro-rata {lakh(r.proRata)}</p>
            </div>
            <div className="right">
              <p className="h4" style={{ color: r.variance < 0 ? "var(--red)" : "var(--green)" }}>
                {r.variance < 0 ? "+" : "−"}{inr(Math.abs(r.variance))}
              </p>
              <Badge color={r.variance < 0 ? "red" : "green"}>{r.variance < 0 ? "over" : "under"}</Badge>
            </div>
          </div>
          <div className="bar"><i style={{ width: `${Math.min(100, r.usedPct)}%`, background: r.variance < 0 ? "var(--red)" : "var(--brand)" }} /></div>
          <div className="row" style={{ marginTop: 7 }}>
            <span className="tiny">Spent {lakh(r.actual)} ({r.usedPct}% of annual)</span>
            {can("accounts.write") && <button className="linkbtn" style={{ fontSize: 11 }} onClick={() => setEdit(r)}>Revise budget</button>}
          </div>
        </div>
      ))}
      {!rows.length && <Empty icon={Icons.Chart} title="No budget heads set" />}

      {edit && (
        <EditBudget r={edit} onClose={() => setEdit(null)} onSave={(v) => {
          patch("budgets", edit.id, { budgeted: v });
          say(`${edit.head} budget revised to ${lakh(v)}`);
          setEdit(null);
        }} />
      )}
    </>
  );
}

function EditBudget({ r, onClose, onSave }) {
  const [v, setV] = useState(String(r.budgeted));
  return (
    <Sheet title={`Revise · ${r.head}`} onClose={onClose}>
      <p className="muted" style={{ marginBottom: 12 }}>
        Spent so far this year: <b>{inr(r.actual)}</b>. A revision is written to the audit trail and shows up in the variance report tabled at the AGM.
      </p>
      <Input label="Annual budget (₹)" type="number" value={v} onChange={(e) => setV(e.target.value)} />
      <Btn block onClick={() => onSave(Number(v) || 0)}>Save revision</Btn>
    </Sheet>
  );
}

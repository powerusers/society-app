import { useMemo, useState } from "react";
import Icons from "../../icons";
import { Badge, Btn, Empty, Sheet, Stat, Alert, TextArea, Segmented } from "../../components/ui";
import { useApp } from "../../store";
import { useActions } from "../../store/actions";
import { inr, lakh, fmtDateTime, fmtDate, dayKey, download, csv, minsBetween } from "../../lib/format";

/** Parses the :61:/:86: pairs of a SWIFT MT940 statement into {amount, narration}. */
function parseMT940(text) {
  const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out = [];
  let pending = null;
  for (const l of lines) {
    if (l.startsWith(":61:")) {
      const m = l.match(/(C|D)R?([\d,.]+)N/i) || l.match(/(C|D)([\d,.]+)/i);
      const raw = m ? m[2].replace(/,(\d{2})$/, ".$1").replace(/,/g, "") : "0";
      pending = { dir: (m?.[1] || "C").toUpperCase(), amount: Number(raw) || 0, narration: "" };
    } else if (l.startsWith(":86:") && pending) {
      pending.narration = l.slice(4).trim();
      out.push(pending);
      pending = null;
    }
  }
  return out;
}

/** Builds a plausible statement from unreconciled payments, plus noise lines that will not match. */
function makeStatement(payments, bank) {
  const d = dayKey().replace(/-/g, "").slice(2);
  const head = [`:20:GVS${d}`, `:25:${bank.ifsc}/${bank.account}`, `:28C:00001/001`, `:60F:C${d}INR000000000000,00`];
  const body = payments.flatMap((p) => [
    `:61:${d}${d.slice(2)}CR${p.amount.toFixed(2).replace(".", ",")}NTRFNONREF`,
    `:86:${p.narration}`,
  ]);
  const noise = [
    `:61:${d}${d.slice(2)}CR15000,00NTRFNONREF`, `:86:NEFT/CR/UNKNOWN PAYER/NO FLAT REF`,
    `:61:${d}${d.slice(2)}DR186000,00NTRFNONREF`, `:86:NEFT/DR/SECURITY AGENCY/JULY INVOICE`,
  ];
  return [...head, ...body, ...noise, `:62F:C${d}INR000000000000,00`].join("\n");
}

export default function Reconciliation() {
  const { db, say } = useApp();
  const A = useActions();
  const [tab, setTab] = useState("import");
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [slip, setSlip] = useState(false);

  const unreconciled = db.payments.filter((p) => !p.reconciled);
  const reconciled = db.payments.filter((p) => p.reconciled);
  const pendingValue = unreconciled.reduce((s, p) => s + p.amount, 0);
  const avgSettle = useMemo(() => {
    const done = db.payments.filter((p) => p.settledAt).slice(0, 200);
    if (!done.length) return 0;
    return Math.round(done.reduce((s, p) => s + minsBetween(p.paidAt, p.settledAt), 0) / done.length);
  }, [db.payments]);

  const fetchStatement = () => {
    setText(makeStatement(unreconciled.slice(0, 25), db.settings.bank));
    say("Statement pulled from the bank feed.");
  };

  const run = () => {
    const lines = parseMT940(text).filter((l) => l.dir === "C");
    if (!lines.length) return say("No credit entries found in that statement.", "bad");
    const r = A.reconcile(lines);
    setResult(r);
  };

  return (
    <>
      <div className="grid3">
        <Stat value={reconciled.length} label="Reconciled" color="var(--green)" />
        <Stat value={unreconciled.length} label="Unmatched" color={unreconciled.length ? "var(--amber)" : "var(--ink3)"} />
        <Stat value={`${avgSettle}m`} label="Avg settlement" color="var(--brand)" />
      </div>

      <div style={{ marginTop: 12 }}>
        <Alert kind="ok" icon={Icons.Bank}>
          Every UPI credit carries the flat number in the bank narration, so an MT940 import matches receipts automatically instead of someone reading a passbook line by line.
        </Alert>
      </div>

      <Segmented value={tab} onChange={setTab} options={[
        { value: "import", label: "MT940 import" },
        { value: "pending", label: `Unmatched (${unreconciled.length})` },
        { value: "slip", label: "Deposit slip" },
      ]} />

      {tab === "import" && (
        <>
          <div className="card">
            <div className="row" style={{ marginBottom: 10 }}>
              <div className="grow">
                <p className="h4">{db.settings.bank.name}</p>
                <p className="tiny" style={{ marginTop: 2 }}>A/c ••••{db.settings.bank.account.slice(-4)} · {db.settings.bank.ifsc}</p>
              </div>
              <Badge color="green">Feed connected</Badge>
            </div>
            <Btn block variant="ghost" icon={Icons.Download} onClick={fetchStatement}>Pull today's statement</Btn>
          </div>
          <TextArea label="MT940 statement" value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Paste the MT940 text from your bank, or pull it with the button above."
            style={{ minHeight: 160, fontFamily: "ui-monospace,monospace", fontSize: 11 }} />
          <Btn block icon={Icons.Refresh} disabled={!text.trim()} onClick={run}>Auto-reconcile</Btn>
          {result && (
            <div style={{ marginTop: 14 }}>
              <Alert kind={result.unmatched.length ? "warn" : "ok"} icon={Icons.CheckCircle}>
                <b>{result.matched} credits matched</b> to receipts automatically. {result.unmatched.length} line{result.unmatched.length === 1 ? "" : "s"} could not be matched.
              </Alert>
              {result.unmatched.length > 0 && (
                <div className="list">
                  {result.unmatched.map((l, i) => (
                    <div key={i} className="li">
                      <div className="ico-tile" style={{ background: "var(--amber-bg)", color: "var(--amber)" }}><Icons.Alert size={17} /></div>
                      <div className="grow">
                        <p className="h4">{inr(l.amount)}</p>
                        <p className="tiny mono" style={{ marginTop: 2 }}>{l.narration}</p>
                      </div>
                      <Badge color="amber">Manual</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === "pending" && (
        <>
          <div className="card">
            <div className="row">
              <span className="muted">Awaiting reconciliation</span>
              <span className="h3">{lakh(pendingValue)}</span>
            </div>
          </div>
          <div className="list">
            {unreconciled.slice(0, 40).map((p) => (
              <div key={p.id} className="li">
                <div className="ico-tile"><Icons.Card size={17} /></div>
                <div className="grow">
                  <p className="h4">{p.flatCode} · {p.receiptNo}</p>
                  <p className="tiny mono" style={{ marginTop: 2 }}>{p.narration}</p>
                  <p className="tiny" style={{ marginTop: 2 }}>{fmtDateTime(p.paidAt)} · {p.mode}</p>
                </div>
                <div className="right">
                  <p className="h4">{inr(p.amount)}</p>
                  <Badge color="amber">Unmatched</Badge>
                </div>
              </div>
            ))}
            {!unreconciled.length && <Empty icon={Icons.CheckCircle} title="Everything is reconciled" note="Every receipt has a matching bank credit." />}
          </div>
        </>
      )}

      {tab === "slip" && <DepositSlip />}
    </>
  );
}

function DepositSlip() {
  const { db } = useApp();
  const b = db.settings.bank;
  const rows = [
    ["Society", db.settings.societyName],
    ["Bank", b.name],
    ["Account number", b.account],
    ["IFSC", b.ifsc],
    ["Account type", "Current — Co-operative Housing Society"],
    ["GSTIN", db.settings.gstin],
  ];
  return (
    <>
      <Alert kind="info" icon={Icons.Doc}>
        A single deposit slip format accepted across Indian banks. Residents paying by cash or cheque write their flat number in the reference field, and the credit reconciles the same way a UPI payment does.
      </Alert>
      <div className="card">
        {rows.map(([k, v], i) => (
          <div key={k}>
            {i > 0 && <div className="hairline" />}
            <div className="row"><span className="muted">{k}</span><b className="right" style={{ maxWidth: 200 }}>{v}</b></div>
          </div>
        ))}
        <div className="hairline" />
        <div className="row"><span className="muted">Reference format</span><b className="mono">GVS/&lt;FLAT&gt;/&lt;YYYYMM&gt;</b></div>
      </div>
      <Btn block variant="ghost" icon={Icons.Download}
        onClick={() => download("deposit-slip.csv", csv([["Field", "Value"], ...rows, ["Reference format", "GVS/<FLAT>/<YYYYMM>"]]))}>
        Download slip details
      </Btn>
    </>
  );
}

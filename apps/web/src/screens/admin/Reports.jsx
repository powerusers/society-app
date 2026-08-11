import { useMemo } from "react";
import Icons from "../../icons";
import { Badge, Btn, Stat, Alert, Empty } from "../../components/ui";
import { useApp } from "../../store";
import { inr, lakh, pct, csv, download, cycleLabel, fmtDate, fmtDateTime, thisCycle, shiftCycle, minsBetween, until } from "../../lib/format";

export default function Reports() {
  const { db, sel } = useApp();

  const cycles = useMemo(() => [...new Set(db.bills.map((b) => b.cycle))].sort().slice(-6), [db.bills]);
  const series = cycles.map((c) => ({ c, billed: sel.billed(c), collected: sel.collected(c) }));
  const maxV = Math.max(1, ...series.map((s) => s.billed));

  const defaulters = useMemo(() => {
    const m = new Map();
    db.bills.filter((b) => b.status !== "paid").forEach((b) => {
      const cur = m.get(b.flatCode) || { flatCode: b.flatCode, amount: 0, cycles: [] };
      cur.amount += b.total; cur.cycles.push(cycleLabel(b.cycle));
      m.set(b.flatCode, cur);
    });
    return [...m.values()].sort((a, b) => b.amount - a.amount);
  }, [db.bills]);

  const income = db.ledger.filter((l) => l.type === "income").reduce((s, l) => s + l.amount, 0);
  const expense = db.ledger.filter((l) => l.type === "expense").reduce((s, l) => s + l.amount, 0);
  const gst = db.bills.reduce((s, b) => s + (b.gst || 0), 0);
  const tds = db.ledger.reduce((s, l) => s + (l.tds || 0), 0);

  const resolved = db.tickets.filter((t) => t.resolvedAt);
  const withinSla = resolved.filter((t) => t.resolvedAt <= t.slaDueAt).length;

  const REPORTS = [
    {
      id: "collection", icon: Icons.Rupee, title: "Collection summary", note: `${cycles.length} cycles · flat-wise billed vs collected`,
      run: () => {
        const head = ["Cycle", "Flats billed", "Billed", "Collected", "Outstanding", "Collection %"];
        const rows = series.map((s) => [cycleLabel(s.c), db.bills.filter((b) => b.cycle === s.c).length, s.billed, s.collected, s.billed - s.collected, `${pct(s.collected, s.billed)}%`]);
        download("collection-summary.csv", csv([head, ...rows]));
      },
    },
    {
      id: "defaulters", icon: Icons.Alert, title: "Defaulters list", note: `${defaulters.length} flats · ${lakh(defaulters.reduce((s, d) => s + d.amount, 0))} outstanding`,
      run: () => {
        const head = ["Flat", "Resident", "Phone", "Outstanding", "Cycles pending"];
        const rows = defaulters.map((d) => {
          const owner = sel.residentsOf(d.flatCode)[0];
          return [d.flatCode, owner?.name || "", owner?.phone || "", d.amount, d.cycles.join(" / ")];
        });
        download("defaulters.csv", csv([head, ...rows]));
      },
    },
    {
      id: "ie", icon: Icons.Board, title: "Income & expenditure", note: `Income ${lakh(income)} · Expense ${lakh(expense)}`,
      run: () => {
        const head = ["Date", "Head", "Type", "Amount", "Flat", "Mode", "TDS", "Note"];
        const rows = db.ledger.map((l) => [fmtDate(l.date), l.head, l.type, l.amount, l.flatCode || "", l.mode || "", l.tds || 0, l.note || ""]);
        download("income-expenditure.csv", csv([head, ...rows]));
      },
    },
    {
      id: "gst", icon: Icons.Doc, title: "GST summary (GSTR-1 basis)", note: `Output GST ${inr(gst)} on amenity heads`,
      run: () => {
        const head = ["Cycle", "Flat", "Taxable value", "GST", "Invoice total", "GSTIN"];
        const rows = db.bills.filter((b) => b.gst > 0).map((b) => [cycleLabel(b.cycle), b.flatCode, b.subtotal, b.gst, b.total, db.settings.gstin]);
        download("gst-summary.csv", csv([head, ...rows]));
      },
    },
    {
      id: "tds", icon: Icons.Bank, title: "TDS deducted (Form 26Q)", note: `${inr(tds)} deducted on vendor payments`,
      run: () => {
        const head = ["Date", "Head", "Vendor", "Gross", "TDS", "Net paid"];
        const rows = db.ledger.filter((l) => l.tds > 0).map((l) => [fmtDate(l.date), l.head, l.vendor || l.head, l.amount, l.tds, l.amount - l.tds]);
        download("tds-26q.csv", csv([head, ...rows]));
      },
    },
    {
      id: "gate", icon: Icons.Gate, title: "Gate & visitor register", note: `${db.visitors.length} entries logged`,
      run: () => {
        const head = ["Name", "Type", "Flat", "Gate", "Status", "Raised by", "Entry", "Exit", "Minutes inside"];
        const rows = db.visitors.map((v) => [v.name, v.category, v.flatCode, sel.gate(v.gateId)?.name || "", v.status, v.raisedBy || "",
          v.entryAt ? fmtDateTime(v.entryAt) : "", v.exitAt ? fmtDateTime(v.exitAt) : "", v.entryAt && v.exitAt ? minsBetween(v.entryAt, v.exitAt) : ""]);
        download("gate-register.csv", csv([head, ...rows]));
      },
    },
    {
      id: "sla", icon: Icons.Ticket, title: "Helpdesk SLA performance", note: `${pct(withinSla, resolved.length || 1)}% resolved within SLA`,
      run: () => {
        const head = ["Ref", "Category", "Flat", "Priority", "Status", "Raised", "SLA due", "Resolved", "Within SLA", "Rating"];
        const rows = db.tickets.map((t) => [t.ref, t.category, t.flatCode, t.priority, t.status, fmtDateTime(t.at), fmtDateTime(t.slaDueAt),
          t.resolvedAt ? fmtDateTime(t.resolvedAt) : "", t.resolvedAt ? (t.resolvedAt <= t.slaDueAt ? "Yes" : "No") : "", t.rating || ""]);
        download("helpdesk-sla.csv", csv([head, ...rows]));
      },
    },
    {
      id: "amenity", icon: Icons.Calendar, title: "Amenity usage & revenue", note: `${db.bookings.length} bookings`,
      run: () => {
        const head = ["Amenity", "Date", "Slot", "Flat", "Guests", "Amount", "Status"];
        const rows = db.bookings.map((b) => [sel.amenity(b.amenityId)?.name || "", b.date, b.slot, b.flatCode, b.guests, b.amount, b.status]);
        download("amenity-usage.csv", csv([head, ...rows]));
      },
    },
    {
      id: "audit", icon: Icons.Lock, title: "Audit trail export", note: `${db.audit.length} recorded actions`,
      run: () => {
        const head = ["When", "Actor", "Action", "Entity", "Detail"];
        const rows = db.audit.map((a) => [fmtDateTime(a.at), sel.userName(a.actor), a.action, a.entity, a.detail || ""]);
        download("audit-trail.csv", csv([head, ...rows]));
      },
    },
  ];

  return (
    <>
      <div className="grid3">
        <Stat value={lakh(income)} label="Income YTD" color="var(--green)" />
        <Stat value={lakh(expense)} label="Expense YTD" color="var(--red)" />
        <Stat value={defaulters.length} label="Defaulters" color="var(--amber)" />
      </div>

      <div className="sect"><h2 className="h2">Collections trend</h2></div>
      <div className="card">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 130, padding: "6px 0" }}>
          {series.map((s) => (
            <div key={s.c} className="grow" style={{ textAlign: "center" }}>
              <div style={{ height: 100, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 3 }}>
                <div title={`Billed ${inr(s.billed)}`} style={{ width: 11, height: `${(s.billed / maxV) * 100}%`, background: "var(--line2)", borderRadius: "4px 4px 0 0" }} />
                <div title={`Collected ${inr(s.collected)}`} style={{ width: 11, height: `${(s.collected / maxV) * 100}%`, background: "var(--brand)", borderRadius: "4px 4px 0 0" }} />
              </div>
              <p className="tiny" style={{ marginTop: 6 }}>{cycleLabel(s.c).split(" ")[0]}</p>
              <p className="tiny" style={{ fontWeight: 700, color: "var(--brand)" }}>{pct(s.collected, s.billed)}%</p>
            </div>
          ))}
        </div>
        <div className="wrap" style={{ marginTop: 8, justifyContent: "center" }}>
          <span className="badge"><i style={{ width: 8, height: 8, background: "var(--line2)", borderRadius: 2, display: "inline-block" }} /> Billed</span>
          <span className="badge"><i style={{ width: 8, height: 8, background: "var(--brand)", borderRadius: 2, display: "inline-block" }} /> Collected</span>
        </div>
      </div>

      <div className="sect"><h2 className="h2">Top defaulters</h2></div>
      <div className="list">
        {defaulters.slice(0, 6).map((d) => {
          const owner = sel.residentsOf(d.flatCode)[0];
          return (
            <div key={d.flatCode} className="li">
              <div className="ico-tile" style={{ background: "var(--red-bg)", color: "var(--red)" }}><Icons.Building size={17} /></div>
              <div className="grow">
                <p className="h4">Flat {d.flatCode}</p>
                <p className="tiny" style={{ marginTop: 2 }}>{owner?.name || "—"} · {d.cycles.length} cycle{d.cycles.length > 1 ? "s" : ""} pending</p>
              </div>
              <p className="h4" style={{ color: "var(--red)" }}>{inr(d.amount)}</p>
            </div>
          );
        })}
        {!defaulters.length && <Empty icon={Icons.CheckCircle} title="No defaulters" note="Every issued bill is settled." />}
      </div>

      <div className="sect"><h2 className="h2">Download reports</h2></div>
      <Alert kind="info" icon={Icons.Download}>Every report exports as CSV, ready for Tally import or the auditor's working papers.</Alert>
      <div className="list">
        {REPORTS.map((r) => (
          <div key={r.id} className="li tap" onClick={r.run}>
            <div className="ico-tile"><r.icon size={18} /></div>
            <div className="grow">
              <p className="h4">{r.title}</p>
              <p className="tiny" style={{ marginTop: 2 }}>{r.note}</p>
            </div>
            <Icons.Download size={16} style={{ color: "var(--brand)" }} />
          </div>
        ))}
      </div>
    </>
  );
}

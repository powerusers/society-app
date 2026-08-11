import { useMemo, useState } from "react";
import Icons from "../../icons";
import { Badge, Empty, SearchBar, Chips, Stat, Btn } from "../../components/ui";
import { CAT, CatTile, STATUS_COLOR } from "../../components/entities";
import { useApp } from "../../store";
import { fmtDateTime, fmtTime, dayKey, csv, download, minsBetween } from "../../lib/format";

export default function GuardLog() {
  const { db, sel, can } = useApp();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return db.visitors
      .filter((v) => filter === "all" || v.category === filter)
      .filter((v) => !t || v.name.toLowerCase().includes(t) || v.flatCode.toLowerCase().includes(t))
      .sort((a, b) => ((b.entryAt || b.createdAt) > (a.entryAt || a.createdAt) ? 1 : -1));
  }, [db.visitors, q, filter]);

  const today = db.visitors.filter((v) => (v.entryAt || v.createdAt).slice(0, 10) === dayKey());
  const denied = today.filter((v) => v.status === "denied").length;

  const exportCsv = () => {
    const head = ["Name", "Type", "Flat", "Gate", "Status", "Raised by", "Entry", "Exit", "Minutes inside"];
    const body = rows.map((v) => [
      v.name, v.category, v.flatCode, sel.gate(v.gateId)?.name || "", v.status, v.raisedBy || "",
      v.entryAt ? fmtDateTime(v.entryAt) : "", v.exitAt ? fmtDateTime(v.exitAt) : "",
      v.entryAt && v.exitAt ? minsBetween(v.entryAt, v.exitAt) : "",
    ]);
    download(`gate-log-${dayKey()}.csv`, csv([head, ...body]));
  };

  return (
    <>
      <div className="grid3">
        <Stat value={today.length} label="Today" color="var(--brand)" />
        <Stat value={today.filter((v) => v.category === "delivery").length} label="Deliveries" color="var(--blue)" />
        <Stat value={denied} label="Denied" color="var(--red)" />
      </div>

      <div style={{ marginTop: 12 }}>
        <SearchBar value={q} onChange={setQ} placeholder="Search visitor or flat…" />
      </div>
      <Chips value={filter} onChange={setFilter} options={[
        { value: "all", label: "All" },
        ...Object.entries(CAT).map(([k, v]) => ({ value: k, label: v.label })),
      ]} />

      <Btn size="sm" variant="ghost" icon={Icons.Download} onClick={exportCsv} style={{ marginBottom: 12 }}>Export CSV</Btn>

      <div className="list">
        {rows.slice(0, 60).map((v) => (
          <div key={v.id} className="li">
            <CatTile category={v.category} />
            <div className="grow">
              <p className="h4 truncate">{v.name}</p>
              <p className="tiny" style={{ marginTop: 2 }}>
                {v.flatCode} · {sel.gate(v.gateId)?.name} · {v.entryAt ? `in ${fmtTime(v.entryAt)}` : "no entry"}{v.exitAt ? ` · out ${fmtTime(v.exitAt)}` : ""}
              </p>
              <p className="tiny" style={{ marginTop: 2 }}>{v.raisedBy}{v.verifiedBy ? ` · verified by ${sel.userName(v.verifiedBy)}` : ""}</p>
            </div>
            <Badge color={STATUS_COLOR[v.status]}>{v.status}</Badge>
          </div>
        ))}
        {!rows.length && <Empty icon={Icons.Clock} title="Nothing in the log" />}
      </div>
    </>
  );
}

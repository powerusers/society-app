import { useMemo, useState } from "react";
import Icons from "../../icons";
import { Badge, Btn, Empty, SearchBar, Chips, Stat } from "../../components/ui";
import { useApp } from "../../store";
import { fmtDateTime, ago, csv, download } from "../../lib/format";

const GROUP = (action = "") => action.split(".")[0];

export default function Audit() {
  const { db, sel } = useApp();
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("all");

  const groups = useMemo(() => [...new Set(db.audit.map((a) => GROUP(a.action)))], [db.audit]);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return db.audit
      .filter((a) => group === "all" || GROUP(a.action) === group)
      .filter((a) => !t || a.entity?.toLowerCase().includes(t) || a.action.toLowerCase().includes(t) || sel.userName(a.actor).toLowerCase().includes(t));
  }, [db.audit, q, group, sel]);

  return (
    <>
      <div className="grid3">
        <Stat value={db.audit.length} label="Actions logged" color="var(--brand)" />
        <Stat value={groups.length} label="Modules" color="var(--blue)" />
        <Stat value={db.audit.filter((a) => a.action.startsWith("billing")).length} label="Billing events" color="var(--amber)" />
      </div>

      <div className="alert info" style={{ marginTop: 12 }}>
        <Icons.Lock size={17} />
        <span className="grow">Every approval, rejection, bill run and setting change is written here with the actor's name. The trail is append-only and exports for the auditor.</span>
      </div>

      <Btn size="sm" variant="ghost" icon={Icons.Download} style={{ marginBottom: 12 }}
        onClick={() => download("audit-trail.csv", csv([["When", "Actor", "Action", "Entity", "Detail"],
          ...rows.map((a) => [fmtDateTime(a.at), sel.userName(a.actor), a.action, a.entity, a.detail || ""])]))}>
        Export trail
      </Btn>

      <SearchBar value={q} onChange={setQ} placeholder="Search actor, action or entity…" />
      <Chips value={group} onChange={setGroup} options={[{ value: "all", label: "All" }, ...groups.map((g) => ({ value: g, label: g }))]} />

      <div className="tl" style={{ marginTop: 6 }}>
        {rows.slice(0, 80).map((a) => (
          <div key={a.id} className="tl-i">
            <div className="row top">
              <div className="grow">
                <p className="h4">{a.entity}</p>
                <p className="tiny" style={{ marginTop: 2 }}>{a.detail}</p>
                <p className="tiny" style={{ marginTop: 3 }}>{sel.userName(a.actor)} · {fmtDateTime(a.at)}</p>
              </div>
              <Badge color="brand">{a.action}</Badge>
            </div>
          </div>
        ))}
      </div>
      {!rows.length && <Empty icon={Icons.Lock} title="Nothing logged yet" />}
    </>
  );
}

import { useState } from "react";
import Icons from "../../icons";
import { Badge, Btn, Empty, Stat, Segmented } from "../../components/ui";
import { IncidentRow } from "../../components/entities";
import { useApp } from "../../store";

export default function Incidents() {
  const { db, can, patch, say } = useApp();
  const [tab, setTab] = useState("open");
  const list = db.incidents.filter((i) => (tab === "all" ? true : i.status === tab));
  const manage = can("helpdesk.manage") || can("incident.write");

  return (
    <>
      <div className="grid3">
        <Stat value={db.incidents.filter((i) => i.status === "open").length} label="Open" color="var(--red)" />
        <Stat value={db.incidents.filter((i) => i.severity === "high").length} label="High severity" color="var(--amber)" />
        <Stat value={db.incidents.filter((i) => i.recording).length} label="With recording" color="var(--purple)" />
      </div>

      <div style={{ marginTop: 12 }}>
        <Segmented value={tab} onChange={setTab} options={[
          { value: "open", label: "Open" }, { value: "closed", label: "Closed" }, { value: "all", label: "All" },
        ]} />
      </div>

      <div className="list">
        {list.map((i) => (
          <div key={i.id}>
            <IncidentRow i={i} />
            {manage && i.status === "open" && (
              <div style={{ padding: "0 14px 12px" }}>
                <Btn size="sm" variant="ghost" icon={Icons.Check}
                  onClick={() => { patch("incidents", i.id, { status: "closed", closedAt: new Date().toISOString() }); say("Incident closed"); }}>
                  Mark reviewed & close
                </Btn>
              </div>
            )}
          </div>
        ))}
        {!list.length && <Empty icon={Icons.Shield} title="No incidents here" note="Anything the guard records with one tap lands in this register." />}
      </div>
    </>
  );
}

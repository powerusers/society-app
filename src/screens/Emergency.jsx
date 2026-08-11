import Icons from "../icons";
import { Badge, Btn, Alert } from "../components/ui";
import { useApp } from "../store";
import { ago } from "../lib/format";

export default function Emergency() {
  const { db, me, add, say, logAudit, sel } = useApp();

  const raise = (kind) => {
    add("sos", { by: me.id, flatCode: me.flat || "Gate", at: new Date().toISOString(), kind, status: "active" });
    logAudit("sos.raise", kind, `${me.name} · ${me.flat || "gate"}`);
    say(`${kind} alert broadcast to all gates and the committee`, "bad");
  };

  const KINDS = [
    { kind: "Medical", icon: Icons.Alert, note: "Ambulance and the nearest first-aid trained resident are alerted" },
    { kind: "Fire", icon: Icons.Zap, note: "All gates, the fire panel and the committee are alerted" },
    { kind: "Security", icon: Icons.Shield, note: "Every guard on duty gets your flat number instantly" },
  ];

  return (
    <>
      <Alert kind="err" icon={Icons.Sos}>
        An SOS reaches all {db.gates.length} gate devices, every guard on duty and the whole committee within seconds — with your flat number attached.
      </Alert>

      <div className="sect"><h2 className="h2">Raise an alert</h2></div>
      <div className="grid3">
        {KINDS.map((k) => (
          <button key={k.kind} className="stat" onClick={() => raise(k.kind)}
            style={{ cursor: "pointer", borderColor: "var(--red-bg)", background: "var(--red-bg)" }}>
            <k.icon size={24} style={{ color: "var(--red)" }} />
            <p className="lbl" style={{ color: "var(--red)", marginTop: 6 }}>{k.kind}</p>
          </button>
        ))}
      </div>

      <div className="sect"><h2 className="h2">Emergency numbers</h2></div>
      <div className="list">
        {db.emergencyContacts.map((c) => (
          <a key={c.id} className="li tap" href={`tel:${c.phone}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div className="ico-tile" style={{ background: "var(--red-bg)", color: "var(--red)" }}><Icons.Phone size={18} /></div>
            <div className="grow">
              <p className="h4">{c.name}</p>
              <p className="tiny" style={{ marginTop: 2 }}>{c.phone}</p>
            </div>
            <Badge color="red">{c.tag}</Badge>
          </a>
        ))}
      </div>

      <div className="sect"><h2 className="h2">Guards on duty</h2></div>
      <div className="list">
        {db.users.filter((u) => u.role === "guard").map((g) => (
          <a key={g.id} className="li tap" href={`tel:${g.phone}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div className="ico-tile"><Icons.Gate size={18} /></div>
            <div className="grow">
              <p className="h4">{g.name}</p>
              <p className="tiny" style={{ marginTop: 2 }}>{sel.gate(g.gate)?.name} · {g.shift}</p>
            </div>
            <Icons.Phone size={17} style={{ color: "var(--brand)" }} />
          </a>
        ))}
      </div>

      {db.sos.length > 0 && (
        <>
          <div className="sect"><h2 className="h2">Recent alerts</h2></div>
          <div className="list">
            {db.sos.slice(0, 8).map((s) => (
              <div key={s.id} className="li">
                <div className="ico-tile" style={{ background: "var(--red-bg)", color: "var(--red)" }}><Icons.Sos size={18} /></div>
                <div className="grow">
                  <p className="h4">{s.kind} alert · {s.flatCode}</p>
                  <p className="tiny" style={{ marginTop: 2 }}>{sel.userName(s.by)} · {ago(s.at)}</p>
                </div>
                <Badge color={s.status === "active" ? "red" : ""}>{s.status}</Badge>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

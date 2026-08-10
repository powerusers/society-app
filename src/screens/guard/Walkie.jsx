import { useEffect, useRef, useState } from "react";
import Icons from "../../icons";
import { Badge, Btn, Empty, Alert } from "../../components/ui";
import { useApp } from "../../store";
import { ago, iso } from "../../lib/format";

/** Push-to-talk across every gate device, with each transmission archived. */
export default function Walkie() {
  const { db, me, sel, add, say } = useApp();
  const [talking, setTalking] = useState(false);
  const [secs, setSecs] = useState(0);
  const timer = useRef(null);
  const clips = db.walkie || [];

  useEffect(() => () => clearInterval(timer.current), []);

  const start = () => {
    setTalking(true); setSecs(0);
    timer.current = setInterval(() => setSecs((s) => s + 1), 1000);
  };
  const stop = () => {
    clearInterval(timer.current);
    setTalking(false);
    if (secs < 1) return;
    add("walkie", {
      by: me.id, at: iso(), secs, gateId: me.gate || "gate_main",
      channel: "All gates", clipId: `CLIP-${Math.floor(Math.random() * 9000 + 1000)}`,
    });
    say(`Transmitted to all ${db.gates.length} gate devices`);
  };

  return (
    <>
      <Alert kind="info" icon={Icons.Radio}>
        Every gate device is on the same channel. Transmissions are recorded and kept, so any instruction can be revisited later.
      </Alert>

      <div className="card center" style={{ padding: 26 }}>
        <p className="tiny" style={{ marginBottom: 14 }}>Channel: <b>All gates</b> · {db.gates.filter((g) => g.status === "online").length} devices online</p>
        <button
          onMouseDown={start} onMouseUp={stop} onMouseLeave={() => talking && stop()}
          onTouchStart={(e) => { e.preventDefault(); start(); }} onTouchEnd={(e) => { e.preventDefault(); stop(); }}
          style={{
            width: 150, height: 150, borderRadius: "50%", border: "none", cursor: "pointer", color: "#fff",
            background: talking ? "linear-gradient(135deg,#C62828,#E53935)" : "linear-gradient(135deg,var(--brand),var(--brand2))",
            boxShadow: talking ? "0 0 0 12px rgba(229,57,53,.16)" : "0 8px 24px rgba(27,77,62,.3)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
            animation: talking ? "pulse 1s infinite" : "none", margin: "0 auto",
          }}>
          <Icons.Mic size={40} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>{talking ? `${secs}s — release to send` : "Hold to talk"}</span>
        </button>
        <div className="grid3" style={{ marginTop: 20 }}>
          {db.gates.map((g) => (
            <div key={g.id} className="stat">
              <p className="h4" style={{ fontSize: 12 }}>{g.name}</p>
              <p className="lbl" style={{ color: g.status === "online" ? "var(--green)" : "var(--red)" }}>{g.status}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="sect"><h2 className="h2">Recorded transmissions</h2></div>
      <div className="list">
        {clips.map((c) => (
          <div key={c.id} className="li">
            <div className="ico-tile"><Icons.Play size={17} /></div>
            <div className="grow">
              <p className="h4">{sel.userName(c.by)} · {c.secs}s</p>
              <p className="tiny" style={{ marginTop: 2 }}>{sel.gate(c.gateId)?.name} → {c.channel} · {ago(c.at)}</p>
            </div>
            <Badge color="purple">{c.clipId}</Badge>
          </div>
        ))}
        {!clips.length && <Empty icon={Icons.Radio} title="No transmissions yet" note="Hold the button above to talk to every gate at once." />}
      </div>
    </>
  );
}

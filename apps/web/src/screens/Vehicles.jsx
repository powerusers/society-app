import { useState } from "react";
import Icons from "../icons";
import { Badge, Btn, Empty, Sheet, Input, Select, Alert, Stat } from "../components/ui";
import QR from "../lib/qr";
import { useApp } from "../store";
import { code6 } from "../lib/format";

export default function Vehicles() {
  const { db, me, sel, add, remove, say, logAudit, can } = useApp();
  const [sheet, setSheet] = useState(null);
  const [pass, setPass] = useState(null);

  const mine = sel.vehiclesOf(me.flat || "");
  const visitorParking = db.visitors.filter((v) => v.vehicle && (v.status === "inside" || v.status === "approved"));

  return (
    <>
      <div className="grid3">
        <Stat value={mine.length} label="Your vehicles" color="var(--brand)" />
        <Stat value={mine.filter((v) => v.kind === "Car").length} label="Four wheeler" color="var(--blue)" />
        <Stat value={visitorParking.length} label="Visitor bay" color="var(--amber)" />
      </div>

      <Btn block icon={Icons.Plus} style={{ margin: "12px 0" }} onClick={() => setSheet("add")}>Add a vehicle</Btn>

      <Alert kind="info" icon={Icons.Camera}>
        Number-plate recognition at the main gate opens the boom barrier for registered vehicles — no app tap, no guard call.
      </Alert>

      <div className="sect"><h2 className="h2">Registered vehicles</h2></div>
      <div className="list">
        {mine.map((v) => (
          <div key={v.id} className="li">
            <div className="ico-tile" style={{ fontSize: 19 }}>{v.kind === "Car" ? "🚗" : "🏍️"}</div>
            <div className="grow">
              <p className="h4">{v.model}</p>
              <p className="tiny" style={{ marginTop: 2 }}>{v.number} · Slot {v.slot} · Sticker {v.sticker}</p>
            </div>
            <button className="x" onClick={() => setPass(v)} aria-label="Show sticker QR"><Icons.QR size={16} /></button>
            <button className="x" style={{ background: "var(--red-bg)", color: "var(--red)", marginLeft: 6 }}
              onClick={() => { remove("vehicles", v.id); say("Vehicle removed"); }} aria-label="Remove"><Icons.Trash size={15} /></button>
          </div>
        ))}
        {!mine.length && <Empty icon={Icons.Car} title="No vehicles registered" note="Register your car or two-wheeler to get a parking sticker and automatic gate entry." />}
      </div>

      {visitorParking.length > 0 && (
        <>
          <div className="sect"><h2 className="h2">Visitor vehicles inside</h2></div>
          <div className="list">
            {visitorParking.map((v) => (
              <div key={v.id} className="li">
                <div className="ico-tile"><Icons.Car size={18} /></div>
                <div className="grow">
                  <p className="h4">{v.vehicle}</p>
                  <p className="tiny" style={{ marginTop: 2 }}>{v.name} · visiting {v.flatCode}</p>
                </div>
                <Badge color="amber">Visitor bay</Badge>
              </div>
            ))}
          </div>
        </>
      )}

      {sheet === "add" && <AddVehicle onClose={() => setSheet(null)} onAdd={(f) => {
        const v = add("vehicles", { ...f, ownerId: me.id, flatCode: me.flat, sticker: `GVS-${code6().slice(0, 4)}` });
        logAudit("vehicle.add", v.number, `${v.kind} · ${me.flat}`);
        say("Vehicle registered ✓");
        setSheet(null);
      }} />}
      {pass && <Sheet title={pass.model} onClose={() => setPass(null)}>
        <QR value={JSON.stringify({ sticker: pass.sticker, number: pass.number, flat: pass.flatCode })} caption={pass.sticker} />
        <p className="muted center" style={{ marginTop: 14 }}>Show this at the gate if the plate reader cannot see the number — in rain, or when the plate is obscured.</p>
      </Sheet>}
    </>
  );
}

function AddVehicle({ onClose, onAdd }) {
  const [f, setF] = useState({ kind: "Car", model: "", number: "", slot: "" });
  const u = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [err, setErr] = useState("");
  return (
    <Sheet title="Add a vehicle" onClose={onClose}>
      <Select label="Type" value={f.kind} onChange={(e) => u("kind", e.target.value)}
        options={[{ value: "Car", label: "🚗 Four wheeler" }, { value: "Bike", label: "🏍️ Two wheeler" }, { value: "EV", label: "⚡ Electric vehicle" }]} />
      <Input label="Make & model" value={f.model} onChange={(e) => { u("model", e.target.value); setErr(""); }} placeholder="e.g. Maruti Swift" />
      <Input label="Registration number" value={f.number} onChange={(e) => u("number", e.target.value.toUpperCase())} placeholder="MH-12-AB-1234" />
      <Input label="Parking slot" value={f.slot} onChange={(e) => u("slot", e.target.value)} placeholder="e.g. P1-42" />
      {err && <p className="err" style={{ marginBottom: 10 }}>{err}</p>}
      <Btn block onClick={() => {
        if (!f.model.trim() || !f.number.trim()) return setErr("Model and registration number are needed");
        onAdd(f);
      }}>Register vehicle</Btn>
    </Sheet>
  );
}

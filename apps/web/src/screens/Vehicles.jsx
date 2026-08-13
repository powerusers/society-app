import { useState } from "react";
import Icons from "../icons";
import { Badge, Btn, Empty, Sheet, Input, Select, Alert, Stat, SkeletonList } from "../components/ui";
import QR from "../lib/qr";
import { useApp } from "../store";
import { useVehicles } from "../data/vehicles";
import { useVisitors } from "../data/visitors";

export default function Vehicles() {
  const { me, can } = useApp();
  const { vehicles, scope, loading, error, refetch, add, update, remove, byPlate } = useVehicles();
  const { visitors } = useVisitors();
  const [sheet, setSheet] = useState(null);
  const [pass, setPass] = useState(null);

  const visitorParking = visitors.filter((v) => v.vehicle && (v.status === "inside" || v.status === "approved"));
  /* The register comes back scoped by the server: a resident's own flat, or the
     whole society for anyone who works the gate. Counting "yours" out of a
     guard's list would report the society's cars as theirs. */
  const society = scope === "society";
  const mine = society ? vehicles.filter((v) => v.flatCode === me.flat) : vehicles;

  return (
    <>
      <div className="grid3">
        <Stat value={mine.length} label="Your vehicles" color="var(--brand)" />
        <Stat value={society ? vehicles.length : mine.filter((v) => v.kind === "Car").length}
          label={society ? "On the register" : "Four wheeler"} color="var(--blue)" />
        <Stat value={visitorParking.length} label="Visitor bay" color="var(--amber)" />
      </div>

      {/* Vehicles are registered against a flat, so this is offered to someone
          who has one — or to the committee, who register on residents' behalf. */}
      {(me.flat || can("resident.approve")) && (
        <Btn block icon={Icons.Plus} style={{ margin: "12px 0" }} onClick={() => setSheet("add")}>Add a vehicle</Btn>
      )}

      {can("gate.view") && (
        <Btn block variant="ghost" icon={Icons.Search} style={{ marginBottom: 12 }} onClick={() => setSheet("plate")}>
          Look up a number plate
        </Btn>
      )}

      <Alert kind="info" icon={Icons.Camera}>
        Number-plate recognition at the main gate opens the boom barrier for registered vehicles — no app tap, no guard call.
      </Alert>

      {error && (
        <Alert kind="err" icon={Icons.AlertTri}>
          {error.message}{" "}
          <button className="linkbtn" style={{ color: "inherit", textDecoration: "underline" }} onClick={refetch}>Retry</button>
        </Alert>
      )}

      <div className="sect"><h2 className="h2">{society ? "Society register" : "Registered vehicles"}</h2></div>
      {loading ? <SkeletonList rows={3} /> : (
        <div className="list">
          {vehicles.map((v) => (
            <div key={v.id} className="li">
              <div className="ico-tile"><Icons.Car size={18} /></div>
              <div className="grow">
                <p className="h4">{v.model}</p>
                <p className="tiny" style={{ marginTop: 2 }}>
                  {[v.number, v.slot ? `Slot ${v.slot}` : "No allotted slot", `Sticker ${v.sticker}`,
                    society && v.flatCode].filter(Boolean).join(" · ")}
                </p>
              </div>
              <button className="x" onClick={() => setPass(v)} aria-label="Show sticker QR"><Icons.QR size={16} /></button>
              {/* Only offered where it would be accepted: the server refuses a
                  neighbour's vehicle, and a button that always fails is worse
                  than no button. */}
              {(v.flatCode === me.flat || can("resident.approve")) && (
                <button className="x" style={{ background: "var(--red-bg)", color: "var(--red)", marginLeft: 6 }}
                  onClick={() => remove(v)} aria-label="Remove"><Icons.Trash size={15} /></button>
              )}
            </div>
          ))}
          {!vehicles.length && (
            <Empty icon={Icons.Car} title="No vehicles registered"
              note="Register your car or two-wheeler to get a parking sticker and automatic gate entry." />
          )}
        </div>
      )}

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

      {sheet === "add" && (
        <AddVehicle canRegisterForOthers={can("resident.approve")} onAdd={add} onClose={() => setSheet(null)} />
      )}
      {sheet === "plate" && <PlateLookup onLook={byPlate} onClose={() => setSheet(null)} />}
      {pass && (
        <Sheet title={pass.model} onClose={() => setPass(null)}>
          <QR value={JSON.stringify({ sticker: pass.sticker, number: pass.number, flat: pass.flatCode })} caption={pass.sticker} />
          <p className="muted center" style={{ marginTop: 14 }}>
            Show this at the gate if the plate reader cannot see the number — in rain, or when the plate is obscured.
          </p>
          {/* The slot is the one thing about a registered car that changes:
              societies re-allot parking, and re-registering the car to do it
              would burn a new sticker number. */}
          <SlotEditor v={pass} onSave={async (slot) => {
            const res = await update(pass, { slot });
            if (res.ok) setPass((p) => ({ ...p, slot }));
            return res;
          }} />
        </Sheet>
      )}
    </>
  );
}

function SlotEditor({ v, onSave }) {
  const [slot, setSlot] = useState(v.slot || "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const changed = slot.trim() !== (v.slot || "");

  return (
    <div style={{ marginTop: 18 }}>
      <Input label="Parking slot" value={slot} placeholder="e.g. P1-42"
        onChange={(e) => { setSlot(e.target.value); setErr(""); }} />
      {err && <p className="err" style={{ marginBottom: 10 }}>{err}</p>}
      {changed && (
        <Btn block variant="ghost" disabled={busy} onClick={async () => {
          setBusy(true);
          const res = await onSave(slot.trim());
          setBusy(false);
          if (res?.ok === false) setErr(res.error?.message || "Could not change the slot");
        }}>{busy ? "Saving…" : "Save slot"}</Btn>
      )}
    </div>
  );
}

/**
 * Whose car is this?
 *
 * The question a guard at the barrier actually has. The answer comes from the
 * server, which will not give it to a resident — the register is not a
 * directory of who drives what.
 */
function PlateLookup({ onLook, onClose }) {
  const [number, setNumber] = useState("");
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const look = async () => {
    if (!number.trim() || busy) return;
    setBusy(true); setErr(""); setResult(null);
    const res = await onLook(number.trim());
    setBusy(false);
    if (res.ok) setResult(res.vehicle);
    else setErr(res.error?.message || "Nothing found");
  };

  return (
    <Sheet title="Look up a number plate" onClose={onClose}>
      <Input label="Registration number" value={number} autoFocus
        onChange={(e) => { setNumber(e.target.value.toUpperCase()); setErr(""); }}
        onKeyDown={(e) => e.key === "Enter" && look()}
        placeholder="MH-12-AB-1234" />
      <Btn block icon={Icons.Search} disabled={busy || !number.trim()} onClick={look}>
        {busy ? "Looking…" : "Look up"}
      </Btn>
      {err && <div style={{ marginTop: 14 }}><Alert kind="warn" icon={Icons.AlertTri}>{err}</Alert></div>}
      {result && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="row top">
            <div className="ico-tile"><Icons.Car size={18} /></div>
            <div className="grow">
              <p className="h3">{result.model}</p>
              <p className="tiny" style={{ marginTop: 3 }}>{result.number} · Sticker {result.sticker}</p>
              <div className="wrap" style={{ marginTop: 6 }}>
                <Badge color="green">Flat {result.flatCode}</Badge>
                <Badge>{result.ownerName}</Badge>
                {result.slot && <Badge color="blue">Slot {result.slot}</Badge>}
              </div>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function AddVehicle({ canRegisterForOthers, onAdd, onClose }) {
  const [f, setF] = useState({ kind: "Car", model: "", number: "", slot: "", flatCode: "" });
  const u = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Sheet title="Add a vehicle" onClose={onClose}>
      <Select label="Type" value={f.kind} onChange={(e) => u("kind", e.target.value)}
        options={[{ value: "Car", label: "Four wheeler" }, { value: "Bike", label: "Two wheeler" }, { value: "EV", label: "Electric vehicle" }]} />
      <Input label="Make & model" value={f.model} onChange={(e) => { u("model", e.target.value); setErr(""); }} placeholder="e.g. Maruti Swift" />
      <Input label="Registration number" value={f.number} onChange={(e) => { u("number", e.target.value.toUpperCase()); setErr(""); }} placeholder="MH-12-AB-1234" />
      <Input label="Parking slot (leave blank if none)" value={f.slot} onChange={(e) => { u("slot", e.target.value); setErr(""); }} placeholder="e.g. P1-42" />
      {/* The committee registers cars for residents who ring the office. Nobody
          else may name a flat: parking a plate on a neighbour's register is how
          a parking dispute starts. */}
      {canRegisterForOthers && (
        <Input label="For which flat (blank for your own)" value={f.flatCode}
          onChange={(e) => u("flatCode", e.target.value.toUpperCase())} placeholder="e.g. B-302" />
      )}
      {err && <p className="err" style={{ marginBottom: 10 }}>{err}</p>}
      <Btn block disabled={busy} onClick={async () => {
        if (!f.model.trim() || !f.number.trim()) return setErr("Model and registration number are needed");
        setBusy(true);
        const res = await onAdd({
          kind: f.kind, model: f.model.trim(), number: f.number.trim(), slot: f.slot.trim(),
          ...(f.flatCode.trim() ? { flatCode: f.flatCode.trim() } : {}),
        });
        setBusy(false);
        if (res?.ok === false) return setErr(res.error?.message || "Could not register that vehicle");
        onClose();
      }}>{busy ? "Registering…" : "Register vehicle"}</Btn>
    </Sheet>
  );
}

import { useState } from "react";
import Icons from "../icons";
import { Badge, Btn, Empty, Sheet, Segmented, Input, TextArea, Alert, SkeletonList, EmojiTile } from "../components/ui";
import { useApp } from "../store";
import { useAmenities } from "../data/amenities";
import { inr, fmtDate, dayKey } from "../lib/format";

export default function Amenities() {
  const { can } = useApp();
  const {
    amenities, classes, mine: myBookings, pending: pendingApprovals, takenSlots,
    loading, error, refetch, book, decide, cancel, addAmenity, retireAmenity, addClass, toggleEnrol,
  } = useAmenities();
  const [tab, setTab] = useState("book");
  const [open, setOpen] = useState(null);
  const [sheet, setSheet] = useState(null);
  const manage = can("amenity.manage");

  return (
    <>
      <Segmented value={tab} onChange={setTab} options={[
        { value: "book", label: "Amenities" },
        { value: "classes", label: "Classes" },
        { value: "mine", label: `Bookings (${myBookings.length})` },
      ]} />

      {error && (
        <Alert kind="err" icon={Icons.AlertTri}>
          {error.message}{" "}
          <button className="linkbtn" style={{ color: "inherit", textDecoration: "underline" }} onClick={refetch}>Retry</button>
        </Alert>
      )}

      {tab === "book" && (loading ? <SkeletonList rows={3} /> : (
        <>
          {manage && (
            <div className="row" style={{ marginBottom: 12 }}>
              <p className="muted">{amenities.length} bookable</p>
              <Btn size="sm" icon={Icons.Plus} onClick={() => setSheet("amenity")}>Add amenity</Btn>
            </div>
          )}
          {amenities.map((a) => {
            const todays = takenSlots(a.id, dayKey());
            return (
              <div key={a.id} className="card tap" onClick={() => setOpen(a)}>
                <div className="row top">
                  <EmojiTile size="lg">{a.emoji}</EmojiTile>
                  <div className="grow">
                    <p className="h3">{a.name}</p>
                    <p className="tiny" style={{ marginTop: 3 }}>Capacity {a.capacity} · {a.slots.length} slots a day</p>
                    <div className="wrap" style={{ marginTop: 6 }}>
                      <Badge color={a.charge ? "amber" : "green"}>{a.charge ? `${inr(a.charge)} / slot` : "Free"}</Badge>
                      {a.deposit > 0 && <Badge color="blue">Deposit {inr(a.deposit)}</Badge>}
                      {a.requiresApproval && <Badge color="amber">Committee approval</Badge>}
                      {todays.length > 0 && <Badge color="purple">{todays.length} booked today</Badge>}
                    </div>
                  </div>
                  <Icons.Fwd size={16} style={{ color: "var(--ink3)" }} />
                </div>
              </div>
            );
          })}
          {!amenities.length && (
            <Empty icon={Icons.Calendar} title="Nothing to book yet"
              note={manage ? "Add the clubhouse, the courts, the lawn — whatever this society lets residents book."
                : "The committee has not listed any amenities yet."} />
          )}
        </>
      ))}

      {tab === "classes" && (
        <>
          <Alert kind="info" icon={Icons.Bulb}>Class fees are added to your next maintenance bill — no separate payment to chase.</Alert>
          {manage && (
            <div className="row" style={{ marginBottom: 12 }}>
              <p className="muted">{classes.length} running</p>
              <Btn size="sm" icon={Icons.Plus} onClick={() => setSheet("class")}>Add class</Btn>
            </div>
          )}
          {classes.map((c) => {
            const full = c.enrolled >= c.seats;
            return (
              <div key={c.id} className="card">
                <div className="row top">
                  <EmojiTile size="lg">{c.emoji}</EmojiTile>
                  <div className="grow">
                    <p className="h3">{c.name}</p>
                    <p className="tiny" style={{ marginTop: 3 }}>
                      {[c.trainer, c.days, c.time].filter(Boolean).join(" · ")}
                    </p>
                    <div className="wrap" style={{ marginTop: 6 }}>
                      <Badge color="amber">{inr(c.fee)} / month</Badge>
                      {/* "Full" rather than "Waitlist": the badge describes the
                          class, and reading "Waitlist" on a class you hold a
                          seat in is a small lie. The button says what tapping
                          does. */}
                      <Badge color={full ? "red" : "green"}>{full ? "Full" : `${c.seats - c.enrolled} seats left`}</Badge>
                      {c.waiting > 0 && <Badge>{c.waiting} waiting</Badge>}
                      {c.amenityName && <Badge>{c.amenityName}</Badge>}
                    </div>
                  </div>
                </div>
                {/* One button, because the class knows whether this resident is
                    already on it — enrolling twice was how the browser version
                    filled five seats with one person. */}
                <Btn size="sm" block style={{ marginTop: 11 }} variant={c.mine || full ? "ghost" : ""}
                  onClick={() => toggleEnrol(c)}>
                  {c.mine === "enrolled" ? "Leave the class"
                    : c.mine === "waitlisted" ? "Leave the waitlist"
                      : full ? "Join the waitlist" : "Enrol"}
                </Btn>
              </div>
            );
          })}
          {!classes.length && (
            <Empty icon={Icons.Users} title="No classes running"
              note={manage ? "Yoga, karate, swimming coaching — add what runs in this society."
                : "Classes the committee sets up will appear here."} />
          )}
        </>
      )}

      {tab === "mine" && (
        <>
          {manage && pendingApprovals.length > 0 && (
            <>
              <div className="sect"><h2 className="h2">Awaiting your approval</h2></div>
              {pendingApprovals.map((b) => (
                <div key={b.id} className="card">
                  <div className="row top">
                    <div className="grow">
                      <p className="h3">{b.amenityName}</p>
                      <p className="tiny" style={{ marginTop: 3 }}>
                        {[b.flatCode, fmtDate(b.date), b.slot, `${b.guests} guests`].filter(Boolean).join(" · ")}
                      </p>
                      {b.note && <p className="tiny" style={{ marginTop: 3 }}>{b.note}</p>}
                    </div>
                    <Badge color="amber">{inr(b.amount)}</Badge>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
                    <Btn size="sm" icon={Icons.Check} onClick={() => decide(b, "confirmed")}>Approve</Btn>
                    <Btn size="sm" variant="danger" icon={Icons.X} onClick={() => decide(b, "cancelled")}>Reject</Btn>
                  </div>
                </div>
              ))}
            </>
          )}

          <div className="sect"><h2 className="h2">Your bookings</h2></div>
          <div className="list">
            {myBookings.map((b) => (
              <div key={b.id} className="li">
                <EmojiTile>{b.amenityEmoji}</EmojiTile>
                <div className="grow">
                  <p className="h4">{b.amenityName}</p>
                  <p className="tiny" style={{ marginTop: 2 }}>{fmtDate(b.date)} · {b.slot} · {inr(b.amount)}</p>
                  {b.status === "cancelled" && b.reason && <p className="tiny" style={{ marginTop: 2 }}>{b.reason}</p>}
                </div>
                <div className="right">
                  <Badge color={b.status === "confirmed" ? "green" : b.status === "pending" ? "amber" : "red"}>{b.status}</Badge>
                  {b.status !== "cancelled" && (
                    <button className="linkbtn" style={{ display: "block", marginTop: 5, fontSize: 11 }}
                      onClick={() => cancel(b)}>Cancel</button>
                  )}
                </div>
              </div>
            ))}
            {!myBookings.length && <Empty icon={Icons.Calendar} title="No bookings yet" />}
          </div>
        </>
      )}

      {open && (
        <BookSheet a={open} taken={takenSlots} canRetire={manage}
          onRetire={async (a) => { const r = await retireAmenity(a); if (r.ok) setOpen(null); }}
          onBook={async (d) => { const r = await book(d); if (r.ok) setOpen(null); return r; }}
          onClose={() => setOpen(null)} />
      )}
      {sheet === "amenity" && (
        <AmenitySheet onAdd={addAmenity} onClose={() => setSheet(null)} />
      )}
      {sheet === "class" && (
        <ClassSheet amenities={amenities} onAdd={addClass} onClose={() => setSheet(null)} />
      )}
    </>
  );
}

function BookSheet({ a, taken, onBook, onRetire, onClose, canRetire }) {
  const [f, setF] = useState({ date: dayKey(), slot: a.slots[0], guests: 1, note: "" });
  const u = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  /* Recomputed as the date changes: the slots free on Saturday are not the
     slots free today, and the old screen only ever asked about today. */
  const busySlots = taken(a.id, f.date);

  return (
    <Sheet title={a.name} onClose={onClose}>
      <div className="card flat">
        <div className="row"><span className="muted">Capacity</span><b>{a.capacity}</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Charge</span><b>{a.charge ? inr(a.charge) : "Free"}</b></div>
        {a.deposit > 0 && <><div className="hairline" /><div className="row"><span className="muted">Refundable deposit</span><b>{inr(a.deposit)}</b></div></>}
      </div>
      {a.rules && <p className="hint" style={{ marginBottom: 14 }}>{a.rules}</p>}
      {a.requiresApproval && (
        <Alert kind="info" icon={Icons.Bulb}>This one needs the committee's approval — your slot is held while they decide.</Alert>
      )}

      <Input label="Date" type="date" value={f.date} min={dayKey()} onChange={(e) => { u("date", e.target.value); setErr(""); }} />
      <p className="field"><label>Slot</label></p>
      <div className="wrap" style={{ marginBottom: 14 }}>
        {a.slots.map((s) => {
          const gone = busySlots.includes(s);
          return (
            <button key={s} className={`chip ${f.slot === s ? "on" : ""}`} disabled={gone}
              style={gone ? { opacity: .45, textDecoration: "line-through" } : undefined}
              onClick={() => u("slot", s)}>{s}</button>
          );
        })}
      </div>
      <Input label="Expected guests" type="number" min={1} max={a.capacity} value={f.guests} onChange={(e) => u("guests", e.target.value)} />
      <TextArea label="Note for the committee (optional)" value={f.note} onChange={(e) => u("note", e.target.value)} placeholder="e.g. Birthday party, catering vendor arriving at 5 PM" />
      {err && <p className="err" style={{ marginBottom: 10 }}>{err}</p>}
      <Btn block icon={Icons.Calendar} disabled={busy || busySlots.includes(f.slot)}
        onClick={async () => {
          setBusy(true);
          /* The clash the screen knows about is only the one it has already
             loaded; the server decides, and says so when someone else got
             there first. */
          const res = await onBook({ amenityId: a.id, date: f.date, slot: f.slot, guests: Number(f.guests), note: f.note });
          setBusy(false);
          if (res?.ok === false) setErr(res.error?.message || "Could not book that slot");
        }}>
        {busy ? "Booking…" : a.charge ? `Book for ${inr(a.charge)}` : "Book slot"}
      </Btn>
      {canRetire && (
        <button className="linkbtn" style={{ marginTop: 14, color: "var(--red)" }} onClick={() => onRetire(a)}>
          Retire this amenity
        </button>
      )}
    </Sheet>
  );
}

function AmenitySheet({ onAdd, onClose }) {
  const [f, setF] = useState({ name: "", emoji: "🏛️", capacity: 10, charge: 0, deposit: 0, slots: "", rules: "", requiresApproval: false });
  const u = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Sheet title="Add an amenity" onClose={onClose}>
      <Input label="Name" value={f.name} onChange={(e) => { u("name", e.target.value); setErr(""); }} placeholder="e.g. Clubhouse Hall" />
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ width: 90 }}><Input label="Icon" value={f.emoji} onChange={(e) => u("emoji", e.target.value)} /></div>
        <div style={{ flex: 1 }}><Input label="Capacity" type="number" min={1} value={f.capacity} onChange={(e) => u("capacity", e.target.value)} /></div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><Input label="Charge per slot (₹)" type="number" min={0} value={f.charge} onChange={(e) => u("charge", e.target.value)} /></div>
        <div style={{ flex: 1 }}><Input label="Deposit (₹)" type="number" min={0} value={f.deposit} onChange={(e) => u("deposit", e.target.value)} /></div>
      </div>
      {/* One slot per line rather than a time picker: societies let the lawn by
          the evening, the court by the hour, and the hall by the half-day. */}
      <TextArea label="Slots, one per line" value={f.slots} onChange={(e) => { u("slots", e.target.value); setErr(""); }}
        placeholder={"09:00–13:00\n14:00–18:00\n19:00–23:00"} />
      <TextArea label="Rules (optional)" value={f.rules} onChange={(e) => u("rules", e.target.value)} />
      <label className="li" style={{ padding: "10px 0" }}>
        <input type="checkbox" checked={f.requiresApproval} onChange={(e) => u("requiresApproval", e.target.checked)} />
        <span className="grow">
          <span className="h4">Needs committee approval</span>
          <span className="tiny" style={{ display: "block", marginTop: 2 }}>The slot is held while a request waits.</span>
        </span>
      </label>
      {err && <p className="err" style={{ marginBottom: 10 }}>{err}</p>}
      <Btn block icon={Icons.Plus} disabled={busy} onClick={async () => {
        const slots = f.slots.split("\n").map((s) => s.trim()).filter(Boolean);
        if (!f.name.trim()) return setErr("Name the amenity");
        if (!slots.length) return setErr("Add at least one slot — nothing can be booked without one");
        setBusy(true);
        const res = await onAdd({
          name: f.name.trim(), emoji: f.emoji.trim() || "🏛️", capacity: Number(f.capacity || 1),
          charge: Number(f.charge || 0), deposit: Number(f.deposit || 0),
          slots, rules: f.rules.trim(), requiresApproval: f.requiresApproval,
        });
        setBusy(false);
        if (res?.ok === false) return setErr(res.error?.message || "Could not add that");
        onClose();
      }}>{busy ? "Adding…" : "Add amenity"}</Btn>
    </Sheet>
  );
}

function ClassSheet({ amenities, onAdd, onClose }) {
  const [f, setF] = useState({ name: "", emoji: "🧘", trainer: "", days: "", time: "", fee: 0, seats: 10, amenityId: "" });
  const u = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Sheet title="Add a class" onClose={onClose}>
      <Input label="Name" value={f.name} onChange={(e) => { u("name", e.target.value); setErr(""); }} placeholder="e.g. Yoga — morning batch" />
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ width: 90 }}><Input label="Icon" value={f.emoji} onChange={(e) => u("emoji", e.target.value)} /></div>
        <div style={{ flex: 1 }}><Input label="Trainer" value={f.trainer} onChange={(e) => u("trainer", e.target.value)} /></div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><Input label="Days" value={f.days} onChange={(e) => u("days", e.target.value)} placeholder="Mon / Wed / Fri" /></div>
        <div style={{ flex: 1 }}><Input label="Time" value={f.time} onChange={(e) => u("time", e.target.value)} placeholder="06:30 – 07:30" /></div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><Input label="Monthly fee (₹)" type="number" min={0} value={f.fee} onChange={(e) => u("fee", e.target.value)} /></div>
        <div style={{ flex: 1 }}><Input label="Seats" type="number" min={1} value={f.seats} onChange={(e) => u("seats", e.target.value)} /></div>
      </div>
      <p className="field"><label>Where it runs (optional)</label></p>
      <div className="wrap" style={{ marginBottom: 14 }}>
        {amenities.map((a) => (
          <button key={a.id} className={`chip ${f.amenityId === a.id ? "on" : ""}`}
            onClick={() => u("amenityId", f.amenityId === a.id ? "" : a.id)}>{a.emoji} {a.name}</button>
        ))}
      </div>
      {err && <p className="err" style={{ marginBottom: 10 }}>{err}</p>}
      <Btn block icon={Icons.Plus} disabled={busy} onClick={async () => {
        if (!f.name.trim()) return setErr("Name the class");
        setBusy(true);
        const res = await onAdd({
          name: f.name.trim(), emoji: f.emoji.trim() || "🧘", trainer: f.trainer.trim(),
          days: f.days.trim(), time: f.time.trim(), fee: Number(f.fee || 0), seats: Number(f.seats || 1),
          amenityId: f.amenityId || null,
        });
        setBusy(false);
        if (res?.ok === false) return setErr(res.error?.message || "Could not add that");
        onClose();
      }}>{busy ? "Adding…" : "Add class"}</Btn>
    </Sheet>
  );
}

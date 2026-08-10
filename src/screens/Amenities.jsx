import { useMemo, useState } from "react";
import Icons from "../icons";
import { Badge, Btn, Empty, Sheet, Segmented, Input, TextArea, Alert, Stat } from "../components/ui";
import { useApp } from "../store";
import { useActions } from "../store/actions";
import { inr, fmtDate, dayKey } from "../lib/format";

export default function Amenities() {
  const { db, me, can, sel, patch, say } = useApp();
  const A = useActions();
  const [tab, setTab] = useState("book");
  const [open, setOpen] = useState(null);
  const [enrolled, setEnrolled] = useState(null);

  const myBookings = db.bookings.filter((b) => b.userId === me.id);
  const pendingApprovals = db.bookings.filter((b) => b.status === "pending");

  return (
    <>
      <Segmented value={tab} onChange={setTab} options={[
        { value: "book", label: "Amenities" },
        { value: "classes", label: "Classes" },
        { value: "mine", label: `Bookings (${myBookings.length})` },
      ]} />

      {tab === "book" && (
        <>
          {db.amenities.map((a) => {
            const todays = db.bookings.filter((b) => b.amenityId === a.id && b.date === dayKey() && b.status !== "cancelled");
            return (
              <div key={a.id} className="card tap" onClick={() => setOpen(a)}>
                <div className="row top">
                  <div className="ico-tile" style={{ fontSize: 21 }}>{a.emoji}</div>
                  <div className="grow">
                    <p className="h3">{a.name}</p>
                    <p className="tiny" style={{ marginTop: 3 }}>Capacity {a.capacity} · {a.slots.length} slots a day</p>
                    <div className="wrap" style={{ marginTop: 6 }}>
                      <Badge color={a.charge ? "amber" : "green"}>{a.charge ? `${inr(a.charge)} / slot` : "Free"}</Badge>
                      {a.deposit > 0 && <Badge color="blue">Deposit {inr(a.deposit)}</Badge>}
                      {todays.length > 0 && <Badge color="purple">{todays.length} booked today</Badge>}
                    </div>
                  </div>
                  <Icons.Fwd size={16} style={{ color: "var(--ink3)" }} />
                </div>
              </div>
            );
          })}
        </>
      )}

      {tab === "classes" && (
        <>
          <Alert kind="info" icon={Icons.Bulb}>Class fees are added to your next maintenance bill — no separate payment to chase.</Alert>
          {db.classes.map((c) => {
            const full = c.enrolled >= c.seats;
            return (
              <div key={c.id} className="card">
                <div className="row top">
                  <div className="ico-tile" style={{ fontSize: 21 }}>{c.emoji}</div>
                  <div className="grow">
                    <p className="h3">{c.name}</p>
                    <p className="tiny" style={{ marginTop: 3 }}>{c.trainer} · {c.days} · {c.time}</p>
                    <div className="wrap" style={{ marginTop: 6 }}>
                      <Badge color="amber">{inr(c.fee)} / month</Badge>
                      <Badge color={full ? "red" : "green"}>{full ? "Waitlist" : `${c.seats - c.enrolled} seats left`}</Badge>
                      <Badge>{sel.amenity(c.amenityId)?.name}</Badge>
                    </div>
                  </div>
                </div>
                <Btn size="sm" block style={{ marginTop: 11 }} variant={full ? "ghost" : ""}
                  onClick={() => { patch("classes", c.id, { enrolled: c.enrolled + 1 }); setEnrolled(c); }}>
                  {full ? "Join the waitlist" : "Enrol"}
                </Btn>
              </div>
            );
          })}
        </>
      )}

      {tab === "mine" && (
        <>
          {can("amenity.manage") && pendingApprovals.length > 0 && (
            <>
              <div className="sect"><h2 className="h2">Awaiting your approval</h2></div>
              {pendingApprovals.map((b) => (
                <div key={b.id} className="card">
                  <div className="row top">
                    <div className="grow">
                      <p className="h3">{sel.amenity(b.amenityId)?.name}</p>
                      <p className="tiny" style={{ marginTop: 3 }}>{b.flatCode} · {fmtDate(b.date)} · {b.slot} · {b.guests} guests</p>
                      {b.note && <p className="tiny" style={{ marginTop: 3 }}>📝 {b.note}</p>}
                    </div>
                    <Badge color="amber">{inr(b.amount)}</Badge>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
                    <Btn size="sm" icon={Icons.Check} onClick={() => { patch("bookings", b.id, { status: "confirmed" }); say("Booking approved ✓"); }}>Approve</Btn>
                    <Btn size="sm" variant="danger" icon={Icons.X} onClick={() => { patch("bookings", b.id, { status: "cancelled" }); say("Booking rejected", "bad"); }}>Reject</Btn>
                  </div>
                </div>
              ))}
            </>
          )}

          <div className="sect"><h2 className="h2">Your bookings</h2></div>
          <div className="list">
            {myBookings.map((b) => (
              <div key={b.id} className="li">
                <div className="ico-tile" style={{ fontSize: 19 }}>{sel.amenity(b.amenityId)?.emoji}</div>
                <div className="grow">
                  <p className="h4">{sel.amenity(b.amenityId)?.name}</p>
                  <p className="tiny" style={{ marginTop: 2 }}>{fmtDate(b.date)} · {b.slot} · {inr(b.amount)}</p>
                </div>
                <div className="right">
                  <Badge color={b.status === "confirmed" ? "green" : b.status === "pending" ? "amber" : "red"}>{b.status}</Badge>
                  {b.status !== "cancelled" && (
                    <button className="linkbtn" style={{ display: "block", marginTop: 5, fontSize: 11 }}
                      onClick={() => { patch("bookings", b.id, { status: "cancelled" }); say("Booking cancelled"); }}>Cancel</button>
                  )}
                </div>
              </div>
            ))}
            {!myBookings.length && <Empty icon={Icons.Calendar} title="No bookings yet" />}
          </div>
        </>
      )}

      {open && <BookSheet a={open} onClose={() => setOpen(null)} onBook={(d) => { A.book(d); setOpen(null); }} />}
      {enrolled && (
        <Sheet title="Enrolled" onClose={() => setEnrolled(null)}>
          <div className="alert ok"><Icons.CheckCircle size={17} /><span className="grow">You are enrolled in <b>{enrolled.name}</b>.</span></div>
          <p className="muted">{enrolled.days} · {enrolled.time} with {enrolled.trainer}. The monthly fee of {inr(enrolled.fee)} will appear on your next maintenance bill under "Clubhouse & amenities".</p>
          <Btn block style={{ marginTop: 16 }} onClick={() => setEnrolled(null)}>Done</Btn>
        </Sheet>
      )}
    </>
  );
}

function BookSheet({ a, onClose, onBook }) {
  const { db } = useApp();
  const [f, setF] = useState({ date: dayKey(), slot: a.slots[0], guests: 1, note: "" });
  const u = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const taken = db.bookings.filter((b) => b.amenityId === a.id && b.date === f.date && b.status !== "cancelled").map((b) => b.slot);

  return (
    <Sheet title={`${a.emoji} ${a.name}`} onClose={onClose}>
      <div className="card flat">
        <div className="row"><span className="muted">Capacity</span><b>{a.capacity}</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Charge</span><b>{a.charge ? inr(a.charge) : "Free"}</b></div>
        {a.deposit > 0 && <><div className="hairline" /><div className="row"><span className="muted">Refundable deposit</span><b>{inr(a.deposit)}</b></div></>}
      </div>
      <p className="hint" style={{ marginBottom: 14 }}>📋 {a.rules}</p>

      <Input label="Date" type="date" value={f.date} min={dayKey()} onChange={(e) => u("date", e.target.value)} />
      <p className="field"><label>Slot</label></p>
      <div className="wrap" style={{ marginBottom: 14 }}>
        {a.slots.map((s) => {
          const busy = taken.includes(s);
          return (
            <button key={s} className={`chip ${f.slot === s ? "on" : ""}`} disabled={busy}
              style={busy ? { opacity: .45, textDecoration: "line-through" } : undefined}
              onClick={() => u("slot", s)}>{s}</button>
          );
        })}
      </div>
      <Input label="Expected guests" type="number" min={1} max={a.capacity} value={f.guests} onChange={(e) => u("guests", e.target.value)} />
      <TextArea label="Note for the committee (optional)" value={f.note} onChange={(e) => u("note", e.target.value)} placeholder="e.g. Birthday party, catering vendor arriving at 5 PM" />
      <Btn block icon={Icons.Calendar} disabled={taken.includes(f.slot)}
        onClick={() => onBook({ amenityId: a.id, date: f.date, slot: f.slot, guests: Number(f.guests), note: f.note, amount: a.charge })}>
        {a.charge ? `Book for ${inr(a.charge)}` : "Book slot"}
      </Btn>
    </Sheet>
  );
}

import { useState } from "react";
import Icons from "../icons";
import { Badge, Btn, Sheet, Alert, Input, TextArea, Empty } from "../components/ui";
import { useApp } from "../store";
import { inr, iso, fmtDate } from "../lib/format";

/** In-house home services — painting, movers, repairs — booked from inside the app. */
export default function Services() {
  const { db, me, add, say, logAudit } = useApp();
  const [open, setOpen] = useState(null);
  const requests = (db.serviceRequests || []).filter((r) => r.by === me.id);

  return (
    <>
      <Alert kind="info" icon={Icons.Tools}>
        Vetted vendors, society rates, and the job tracked in-app. The vendor's gate pass is issued automatically for the scheduled date.
      </Alert>

      <div className="sect"><h2 className="h2">Book a service</h2></div>
      {db.services.map((s) => (
        <div key={s.id} className="card tap" onClick={() => setOpen(s)}>
          <div className="row top">
            <div className="ico-tile" style={{ fontSize: 21 }}>{s.emoji}</div>
            <div className="grow">
              <p className="h3">{s.name}</p>
              <p className="tiny" style={{ marginTop: 3 }}>{s.desc}</p>
              <div className="wrap" style={{ marginTop: 6 }}>
                <Badge color="green">From {inr(s.from)}</Badge>
                <Badge color="amber">★ {s.rating}</Badge>
                <Badge>{s.jobs}+ jobs</Badge>
              </div>
            </div>
            <Icons.Fwd size={16} style={{ color: "var(--ink3)" }} />
          </div>
        </div>
      ))}

      {requests.length > 0 && (
        <>
          <div className="sect"><h2 className="h2">Your requests</h2></div>
          <div className="list">
            {requests.map((r) => (
              <div key={r.id} className="li">
                <div className="ico-tile" style={{ fontSize: 19 }}>{db.services.find((s) => s.id === r.serviceId)?.emoji}</div>
                <div className="grow">
                  <p className="h4">{r.serviceName}</p>
                  <p className="tiny" style={{ marginTop: 2 }}>Preferred {fmtDate(r.date)} · raised {fmtDate(r.at)}</p>
                </div>
                <Badge color="amber">{r.status}</Badge>
              </div>
            ))}
          </div>
        </>
      )}

      {open && (
        <RequestSheet s={open} onClose={() => setOpen(null)} onSubmit={(f) => {
          add("serviceRequests", { ...f, serviceId: open.id, serviceName: open.name, by: me.id, flatCode: me.flat, at: iso(), status: "quote requested" });
          logAudit("service.request", open.name, me.flat);
          say("Request sent — a coordinator will call you within a day.");
          setOpen(null);
        }} />
      )}
    </>
  );
}

function RequestSheet({ s, onClose, onSubmit }) {
  const [f, setF] = useState({ date: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10), note: "" });
  return (
    <Sheet title={`${s.emoji} ${s.name}`} onClose={onClose}>
      <p className="muted" style={{ marginBottom: 12 }}>{s.desc}</p>
      <div className="card flat">
        <div className="row"><span className="muted">Starting at</span><b>{inr(s.from)}</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Rating</span><b>★ {s.rating} · {s.jobs}+ jobs</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Gate pass</span><b>Issued automatically</b></div>
      </div>
      <Input label="Preferred date" type="date" value={f.date} onChange={(e) => setF((p) => ({ ...p, date: e.target.value }))} />
      <TextArea label="What do you need?" value={f.note} onChange={(e) => setF((p) => ({ ...p, note: e.target.value }))} placeholder="e.g. 2BHK repaint, one accent wall" />
      <Btn block icon={Icons.Send} onClick={() => onSubmit(f)}>Request a quote</Btn>
    </Sheet>
  );
}

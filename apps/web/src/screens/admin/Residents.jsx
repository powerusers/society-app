import { useMemo, useState } from "react";
import Icons from "../../icons";
import { Badge, Btn, Empty, Sheet, Segmented, SearchBar, Chips, Stat, Avatar, TextArea, Alert } from "../../components/ui";
import { useApp } from "../../store";
import { useActions } from "../../store/actions";
import { fmtDate, ago, inr, csv, download } from "../../lib/format";

export default function Residents() {
  const { db, sel, can } = useApp();
  const A = useActions();
  const [tab, setTab] = useState("approvals");
  const [q, setQ] = useState("");
  const [block, setBlock] = useState("all");
  const [reject, setReject] = useState(null);
  const [open, setOpen] = useState(null);

  const pending = db.registrations.filter((r) => r.status === "pending");
  const residents = db.users.filter((u) => u.role !== "guard" && u.role !== "staff");

  const flats = useMemo(() => {
    const t = q.trim().toLowerCase();
    return db.flats
      .filter((f) => block === "all" || f.block === block)
      .filter((f) => !t || f.code.toLowerCase().includes(t) || sel.residentsOf(f.code).some((r) => r.name.toLowerCase().includes(t)));
  }, [db.flats, block, q, sel]);

  const exportRegister = () => {
    const head = ["Flat", "Type", "Area", "Occupancy", "Owner", "Phone", "Email", "Tenant", "Outstanding"];
    const rows = db.flats.map((f) => {
      const people = sel.residentsOf(f.code);
      const owner = people.find((p) => p.relation === "owner");
      const tenant = people.find((p) => p.relation === "tenant");
      return [f.code, f.type, f.area, f.occupancy, owner?.name || "", owner?.phone || "", owner?.email || "", tenant?.name || "", sel.duesOf(f.code)];
    });
    download("flat-register.csv", csv([head, ...rows]));
  };

  return (
    <>
      <div className="grid3">
        <Stat value={db.flats.length} label="Flats" color="var(--brand)" />
        <Stat value={residents.length} label="Residents" color="var(--blue)" />
        <Stat value={pending.length} label="Approvals" color={pending.length ? "var(--amber)" : "var(--ink3)"} />
      </div>

      <div style={{ marginTop: 12 }}>
        <Segmented value={tab} onChange={setTab} options={[
          { value: "approvals", label: `Approvals (${pending.length})` },
          { value: "register", label: "Flat register" },
        ]} />
      </div>

      {tab === "approvals" && (
        <>
          {pending.length === 0 && <Empty icon={Icons.CheckCircle} title="All registrations processed" note="New sign-ups land here for verification before they get app access." />}
          {pending.map((r) => (
            <div key={r.id} className="card">
              <div className="row top">
                <Avatar name={r.name} />
                <div className="grow" style={{ marginLeft: 11 }}>
                  <p className="h3">{r.name}</p>
                  <p className="tiny" style={{ marginTop: 3 }}>Flat {r.flatCode} · {r.relation} · applied {ago(r.at)}</p>
                  <p className="tiny" style={{ marginTop: 3 }}>{r.phone} · {r.email}</p>
                  <div className="wrap" style={{ marginTop: 6 }}>
                    {(r.docs || []).map((d) => <Badge key={d} color="blue">{d}</Badge>)}
                    {!r.docs?.length && <Badge color="amber">No documents attached</Badge>}
                  </div>
                </div>
              </div>
              {!db.flats.some((f) => f.code === r.flatCode) && (
                <div className="alert err" style={{ marginTop: 10, marginBottom: 0 }}>
                  <Icons.AlertTri size={16} /><span>Flat {r.flatCode} is not on the society register — verify before approving.</span>
                </div>
              )}
              {can("resident.approve") && (
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <Btn size="sm" icon={Icons.Check} onClick={() => A.approveRegistration(r)}>Approve</Btn>
                  <Btn size="sm" variant="danger" icon={Icons.X} onClick={() => setReject(r)}>Reject</Btn>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {tab === "register" && (
        <>
          <Btn size="sm" variant="ghost" icon={Icons.Download} onClick={exportRegister} style={{ marginBottom: 12 }}>Export register</Btn>
          <SearchBar value={q} onChange={setQ} placeholder="Search flat or resident…" />
          <Chips value={block} onChange={setBlock} options={[{ value: "all", label: "All blocks" }, ...db.settings.blocks.map((b) => ({ value: b, label: `Block ${b}` }))]} />
          <div className="list">
            {flats.slice(0, 60).map((f) => {
              const people = sel.residentsOf(f.code);
              const dues = sel.duesOf(f.code);
              return (
                <div key={f.id} className="li tap" onClick={() => setOpen(f)}>
                  <div className="ico-tile"><Icons.Building size={17} /></div>
                  <div className="grow">
                    <p className="h4">Flat {f.code}</p>
                    <p className="tiny" style={{ marginTop: 2 }}>{people[0]?.name || "Vacant"} · {f.type} · {f.area} sqft</p>
                  </div>
                  <div className="right">
                    <Badge color={f.occupancy === "tenant" ? "purple" : "green"}>{f.occupancy === "tenant" ? "Tenanted" : "Owner"}</Badge>
                    {dues > 0 && <p className="tiny" style={{ color: "var(--red)", marginTop: 4, fontWeight: 700 }}>{inr(dues)}</p>}
                  </div>
                </div>
              );
            })}
          </div>
          {flats.length > 60 && <p className="hint center">Showing 60 of {flats.length} flats.</p>}
        </>
      )}

      {reject && (
        <Sheet title={`Reject ${reject.name}?`} onClose={() => setReject(null)}>
          <RejectForm onCancel={() => setReject(null)} onSubmit={(reason) => { A.rejectRegistration(reject, reason); setReject(null); }} />
        </Sheet>
      )}
      {open && <FlatSheet f={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function RejectForm({ onCancel, onSubmit }) {
  const [reason, setReason] = useState("");
  return (
    <>
      <TextArea label="Reason (shared with the applicant)" value={reason} onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. Rent agreement not attached; please re-apply with documents." />
      <div style={{ display: "flex", gap: 9 }}>
        <Btn variant="ghost" block onClick={onCancel}>Cancel</Btn>
        <Btn variant="danger" block onClick={() => onSubmit(reason)}>Reject application</Btn>
      </div>
    </>
  );
}

function FlatSheet({ f, onClose }) {
  const { db, sel } = useApp();
  const people = sel.residentsOf(f.code);
  const bills = sel.billsOf(f.code).slice(0, 4);
  const vehicles = sel.vehiclesOf(f.code);
  const help = sel.helpOf(f.code);
  return (
    <Sheet title={`Flat ${f.code}`} onClose={onClose}>
      <div className="card flat">
        <div className="row"><span className="muted">Configuration</span><b>{f.type} · {f.area} sqft</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Occupancy</span><b style={{ textTransform: "capitalize" }}>{f.occupancy}</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Outstanding</span><b style={{ color: sel.duesOf(f.code) ? "var(--red)" : "var(--green)" }}>{inr(sel.duesOf(f.code))}</b></div>
      </div>

      <p className="h4" style={{ margin: "8px 0" }}>Occupants</p>
      <div className="list">
        {people.map((p) => (
          <div key={p.id} className="li">
            <Avatar name={p.name} />
            <div className="grow"><p className="h4">{p.name}</p><p className="tiny">{p.relation} · {p.phone}</p></div>
            <Badge color={p.relation === "owner" ? "green" : "purple"}>{p.relation}</Badge>
          </div>
        ))}
        {!people.length && <Empty icon={Icons.Home} title="Vacant flat" />}
      </div>

      <p className="h4" style={{ margin: "12px 0 8px" }}>Recent bills</p>
      <div className="list">
        {bills.map((b) => (
          <div key={b.id} className="li">
            <div className="grow"><p className="h4">{b.cycle}</p><p className="tiny">Due {fmtDate(b.dueDate)}</p></div>
            <div className="right"><p className="h4">{inr(b.total)}</p><Badge color={b.status === "paid" ? "green" : "amber"}>{b.status}</Badge></div>
          </div>
        ))}
      </div>

      <div className="grid2" style={{ marginTop: 12 }}>
        <div className="stat"><p className="num">{vehicles.length}</p><p className="lbl">Vehicles</p></div>
        <div className="stat"><p className="num">{help.length}</p><p className="lbl">Daily help</p></div>
      </div>
    </Sheet>
  );
}

import { useMemo, useState } from "react";
import Icons from "../../icons";
import { Badge, Btn, Empty, Sheet, Segmented, SearchBar, Chips, Stat, Avatar, TextArea, Alert, SkeletonList } from "../../components/ui";
import { useApp } from "../../store";
import { useFlats, useFlat } from "../../data/flats";
import { useRegistrations } from "../../data/registrations";
import { fmtDate, ago, inr, csv, download } from "../../lib/format";

/* The register stores owner-occupied / tenant-occupied / vacant; the demo seed
   predates that and says "tenant". Both are read here so a vacant flat is
   labelled vacant rather than silently shown as owner-occupied. */
const OCCUPANCY = {
  "owner-occupied": { label: "Owner", tone: "green" },
  owner: { label: "Owner", tone: "green" },
  "tenant-occupied": { label: "Tenanted", tone: "purple" },
  tenant: { label: "Tenanted", tone: "purple" },
  vacant: { label: "Vacant", tone: "" },
};
const occupancyOf = (v) => OCCUPANCY[v] || { label: v || "—", tone: "" };

export default function Residents() {
  const { live, can, sel } = useApp();
  const { flats, blocks, loading: flatsLoading, error: flatsError, refetch: refetchFlats } = useFlats();
  const { registrations: pending, loading: regsLoading, error: regsError, approve, reject, refetch: refetchRegs } =
    useRegistrations("pending");

  const [tab, setTab] = useState("approvals");
  const [q, setQ] = useState("");
  const [block, setBlock] = useState("all");
  const [rejecting, setRejecting] = useState(null);
  const [open, setOpen] = useState(null);

  const duesOf = (f) => (live ? (f.dues ?? 0) : sel.duesOf(f.code));
  const occupied = flats.filter((f) => f.occupancy && f.occupancy !== "vacant").length;

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return flats
      .filter((f) => block === "all" || f.block === block)
      .filter((f) => !t || f.code.toLowerCase().includes(t));
  }, [flats, block, q]);

  /* Exported in the same shape the importer reads, so a register can go out,
     be corrected in a spreadsheet, and come back in without re-typing. */
  const exportRegister = () => {
    const head = ["code", "block", "floor", "type", "area", "occupancy", "parking", "outstanding"];
    const rows = flats.map((f) => [f.code, f.block, f.floor, f.type, f.area, f.occupancy, f.parkingSlots ?? "", duesOf(f)]);
    download("flat-register.csv", csv([head, ...rows]));
  };

  return (
    <>
      <div className="grid3">
        <Stat value={flats.length} label="Flats" />
        <Stat value={occupied} label="Occupied" />
        <Stat value={pending.length} label="Approvals" />
      </div>

      <div style={{ marginTop: 12 }}>
        <Segmented value={tab} onChange={setTab} options={[
          { value: "approvals", label: `Approvals (${pending.length})` },
          { value: "register", label: `Flat register (${flats.length})` },
        ]} />
      </div>

      {tab === "approvals" && (
        <>
          {regsError && (
            <Alert kind="err" icon={Icons.AlertTri}>
              {regsError.message}{" "}
              <button className="linkbtn" style={{ color: "inherit", textDecoration: "underline" }} onClick={refetchRegs}>Retry</button>
            </Alert>
          )}
          {regsLoading ? <SkeletonList rows={2} /> : (
            <>
              {pending.length === 0 && (
                <Empty icon={Icons.CheckCircle} title="No applications waiting"
                  note="Residents who register against a flat on the register appear here for verification before they get access." />
              )}
              {pending.map((r) => (
                <div key={r.id} className="card">
                  <div className="row top">
                    <Avatar name={r.name} />
                    <div className="grow" style={{ marginLeft: 11 }}>
                      <p className="h3">{r.name}</p>
                      <p className="tiny" style={{ marginTop: 3 }}>Flat {r.flatCode} · {r.relation} · applied {ago(r.at)}</p>
                      <p className="tiny" style={{ marginTop: 3 }}>{r.phone} · {r.email}</p>
                      {(r.docs || []).length > 0 && (
                        <div className="wrap" style={{ marginTop: 6 }}>
                          {r.docs.map((d) => <Badge key={d} color="blue">{d}</Badge>)}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Only claimed once the register has loaded — an empty list mid-fetch
                      would accuse every applicant of naming a flat that does not exist. */}
                  {!flatsLoading && flats.length > 0 && !flats.some((f) => f.code === r.flatCode) && (
                    <div className="alert err" style={{ marginTop: 10, marginBottom: 0 }}>
                      <Icons.AlertTri size={16} />
                      <span>Flat {r.flatCode} is not on the society register — verify before approving.</span>
                    </div>
                  )}
                  {can("resident.approve") && (
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <Btn size="sm" icon={Icons.Check} onClick={() => approve(r)}>Approve</Btn>
                      <Btn size="sm" variant="danger" icon={Icons.X} onClick={() => setRejecting(r)}>Reject</Btn>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </>
      )}

      {tab === "register" && (
        <>
          {flatsError && (
            <Alert kind="err" icon={Icons.AlertTri}>
              {flatsError.message}{" "}
              <button className="linkbtn" style={{ color: "inherit", textDecoration: "underline" }} onClick={refetchFlats}>Retry</button>
            </Alert>
          )}
          {flatsLoading ? <SkeletonList rows={5} /> : flats.length === 0 ? (
            <Empty icon={Icons.Building} title="No flats on the register yet"
              note={can("settings.write")
                ? "Import the society's flat register from a CSV — More › Flat register."
                : "An administrator needs to import the society's flat register."} />
          ) : (
            <>
              <Btn size="sm" variant="ghost" icon={Icons.Download} onClick={exportRegister} style={{ marginBottom: 12 }}>
                Export register
              </Btn>
              <SearchBar value={q} onChange={setQ} placeholder="Search by flat number…" />
              {blocks.length > 1 && (
                <Chips value={block} onChange={setBlock}
                  options={[{ value: "all", label: "All blocks" }, ...blocks.map((b) => ({ value: b, label: `Block ${b}` }))]} />
              )}
              <div className="list">
                {shown.slice(0, 60).map((f) => {
                  const occ = occupancyOf(f.occupancy);
                  const dues = duesOf(f);
                  return (
                    <div key={f.id || f.code} className="li tap" onClick={() => setOpen(f)}>
                      <div className="ico-tile"><Icons.Building size={17} /></div>
                      <div className="grow">
                        <p className="h4">Flat {f.code}</p>
                        <p className="tiny" style={{ marginTop: 2 }}>
                          {[f.type, f.area && `${f.area} sqft`, f.floor != null && `floor ${f.floor}`].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <div className="right">
                        <Badge color={occ.tone}>{occ.label}</Badge>
                        {dues > 0 && <p className="tiny" style={{ color: "var(--bad)", marginTop: 4, fontWeight: 600 }}>{inr(dues)}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {shown.length > 60 && <p className="hint center">Showing 60 of {shown.length} flats.</p>}
              {shown.length === 0 && <p className="hint center">No flat matches that search.</p>}
            </>
          )}
        </>
      )}

      {rejecting && (
        <Sheet title={`Reject ${rejecting.name}?`} onClose={() => setRejecting(null)}>
          <RejectForm onCancel={() => setRejecting(null)}
            onSubmit={(reason) => { reject(rejecting, reason); setRejecting(null); }} />
        </Sheet>
      )}
      {open && <FlatSheet f={open} dues={duesOf(open)} onClose={() => setOpen(null)} />}
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

function FlatSheet({ f, dues, onClose }) {
  const { live, sel } = useApp();
  const { occupants, loading } = useFlat(f.code);
  const occ = occupancyOf(f.occupancy);
  /* Bills, vehicles and daily help have no per-flat endpoint yet, so they are
     shown only where the data is real rather than rendered as empty lists. */
  const bills = live ? [] : sel.billsOf(f.code).slice(0, 4);

  return (
    <Sheet title={`Flat ${f.code}`} onClose={onClose}>
      <div className="card flat">
        <div className="row"><span className="muted">Configuration</span><b>{[f.type, f.area && `${f.area} sqft`].filter(Boolean).join(" · ")}</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Block & floor</span><b>{f.block} · floor {f.floor}</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Occupancy</span><b>{occ.label}</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Parking</span><b>{f.parkingSlots ?? "—"}</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Outstanding</span><b style={{ color: dues ? "var(--bad)" : "var(--ok)" }}>{inr(dues)}</b></div>
      </div>

      <p className="h4" style={{ margin: "8px 0" }}>Occupants</p>
      {loading ? <SkeletonList rows={2} /> : (
        <div className="list">
          {occupants.map((p) => (
            <div key={p.id} className="li">
              <Avatar name={p.name} />
              <div className="grow">
                <p className="h4">{p.name}</p>
                <p className="tiny">{[p.relation, p.phone].filter(Boolean).join(" · ")}</p>
              </div>
              {p.relation && <Badge color={p.relation === "owner" ? "green" : "purple"}>{p.relation}</Badge>}
            </div>
          ))}
          {!occupants.length && (
            <Empty icon={Icons.Home} title="Nobody registered yet"
              note="Residents appear here once they register against this flat and the committee approves them." />
          )}
        </div>
      )}

      {bills.length > 0 && (
        <>
          <p className="h4" style={{ margin: "12px 0 8px" }}>Recent bills</p>
          <div className="list">
            {bills.map((b) => (
              <div key={b.id} className="li">
                <div className="grow"><p className="h4">{b.cycle}</p><p className="tiny">Due {fmtDate(b.dueDate)}</p></div>
                <div className="right"><p className="h4">{inr(b.total)}</p><Badge color={b.status === "paid" ? "green" : "amber"}>{b.status}</Badge></div>
              </div>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}

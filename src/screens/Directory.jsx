import { useMemo, useState } from "react";
import Icons from "../icons";
import { Badge, Empty, SearchBar, Chips, Sheet, Avatar, Btn, Alert } from "../components/ui";
import { useApp } from "../store";
import { fmtDate } from "../lib/format";

/** Resident directory. Numbers are masked unless the resident opted in. */
export default function Directory() {
  const { db, me, can, sel } = useApp();
  const [q, setQ] = useState("");
  const [block, setBlock] = useState("all");
  const [open, setOpen] = useState(null);

  const people = useMemo(() => {
    const t = q.trim().toLowerCase();
    return db.users
      .filter((u) => u.role !== "guard" && u.role !== "staff")
      .filter((u) => block === "all" || u.block === block)
      .filter((u) => !t || u.name.toLowerCase().includes(t) || (u.flat || "").toLowerCase().includes(t))
      .sort((a, b) => (a.flat || "").localeCompare(b.flat || ""));
  }, [db.users, q, block]);

  const committee = db.users.filter((u) => u.role === "committee" || u.role === "admin");

  return (
    <>
      <Alert kind="info" icon={Icons.Lock}>
        Contact numbers are masked by default. A resident's number is visible only to the committee, or when they have chosen to share it in the directory.
      </Alert>

      <div className="sect"><h2 className="h2">Managing committee</h2></div>
      <div className="list">
        {committee.map((u) => (
          <div key={u.id} className="li tap" onClick={() => setOpen(u)}>
            <Avatar name={u.name} />
            <div className="grow">
              <p className="h4">{u.name}</p>
              <p className="tiny" style={{ marginTop: 2 }}>{u.designation || "Committee member"} · {u.flat}</p>
            </div>
            <Badge color="brand">{u.role}</Badge>
          </div>
        ))}
      </div>

      <div className="sect"><h2 className="h2">Residents ({people.length})</h2></div>
      <SearchBar value={q} onChange={setQ} placeholder="Search name or flat…" />
      <Chips value={block} onChange={setBlock} options={[{ value: "all", label: "All blocks" }, ...db.settings.blocks.map((b) => ({ value: b, label: `Block ${b}` }))]} />

      <div className="list">
        {people.slice(0, 60).map((u) => (
          <div key={u.id} className="li tap" onClick={() => setOpen(u)}>
            <Avatar name={u.name} />
            <div className="grow">
              <p className="h4">{u.name}</p>
              <p className="tiny" style={{ marginTop: 2 }}>Flat {u.flat} · {u.relation || "resident"}</p>
            </div>
            <Icons.Fwd size={15} style={{ color: "var(--ink3)" }} />
          </div>
        ))}
        {!people.length && <Empty icon={Icons.Users} title="No residents match" />}
      </div>
      {people.length > 60 && <p className="hint center">Showing the first 60 of {people.length}. Refine your search to see more.</p>}

      {open && <PersonSheet u={open} onClose={() => setOpen(null)} canSeePhone={can("resident.approve") || open.notify?.community} />}
    </>
  );
}

function PersonSheet({ u, onClose, canSeePhone }) {
  const { db, sel } = useApp();
  const flat = sel.flatByCode(u.flat);
  const family = db.users.filter((x) => x.flat === u.flat);
  const masked = u.phone ? `${u.phone.slice(0, 2)}••••${u.phone.slice(-2)}` : "—";
  return (
    <Sheet title={u.name} onClose={onClose}>
      <div className="center" style={{ marginBottom: 16 }}>
        <Avatar name={u.name} size="lg" />
        <p className="h3" style={{ marginTop: 10 }}>{u.name}</p>
        <p className="tiny">{u.designation || u.relation || "Resident"} · Flat {u.flat}</p>
      </div>
      <div className="card flat">
        <div className="row"><span className="muted">Flat</span><b>{u.flat}{flat ? ` · ${flat.type} · ${flat.area} sqft` : ""}</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Resident since</span><b>{fmtDate(u.joined)}</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Phone</span><b>{canSeePhone ? u.phone : masked}</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Email</span><b className="truncate" style={{ maxWidth: 180 }}>{u.email}</b></div>
      </div>
      {family.length > 1 && (
        <>
          <p className="h4" style={{ margin: "6px 0 8px" }}>Also in this flat</p>
          <div className="list">
            {family.filter((x) => x.id !== u.id).map((x) => (
              <div key={x.id} className="li">
                <Avatar name={x.name} />
                <div className="grow"><p className="h4">{x.name}</p><p className="tiny">{x.relation}</p></div>
              </div>
            ))}
          </div>
        </>
      )}
      {canSeePhone && u.phone && (
        <a className="btn block" href={`tel:${u.phone}`} style={{ textDecoration: "none", marginTop: 12 }}>
          <Icons.Phone size={16} /> Call {u.name.split(" ")[0]}
        </a>
      )}
    </Sheet>
  );
}

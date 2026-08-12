import { useMemo, useState } from "react";
import Icons from "../icons";
import { Badge, Empty, SearchBar, Chips, Sheet, Avatar, Alert, SkeletonList } from "../components/ui";
import { useDirectory } from "../data/directory";
import { fmtDate } from "../lib/format";

/** Resident directory. Numbers are masked unless the resident opted in. */
export default function Directory() {
  const { people, blocks, loading, error, refetch } = useDirectory();
  const [q, setQ] = useState("");
  const [block, setBlock] = useState("all");
  const [open, setOpen] = useState(null);

  const residents = useMemo(() => {
    const t = q.trim().toLowerCase();
    return people
      .filter((u) => u.role !== "guard" && u.role !== "staff")
      .filter((u) => block === "all" || u.block === block)
      .filter((u) => !t || u.name.toLowerCase().includes(t) || (u.flat || "").toLowerCase().includes(t))
      .sort((a, b) => (a.flat || "").localeCompare(b.flat || ""));
  }, [people, q, block]);

  const committee = people.filter((u) => u.role === "committee" || u.role === "admin");

  return (
    <>
      <Alert kind="info" icon={Icons.Lock}>
        Contact numbers are masked by default. A resident's number is visible only to the committee,
        or when they have chosen to share it in the directory.
      </Alert>

      {error && (
        <Alert kind="err" icon={Icons.AlertTri}>
          {error.message}{" "}
          <button className="linkbtn" style={{ color: "inherit", textDecoration: "underline" }} onClick={refetch}>Retry</button>
        </Alert>
      )}

      {loading ? <SkeletonList rows={5} /> : (
        <>
          {committee.length > 0 && (
            <>
              <div className="sect"><h2 className="h2">Managing committee</h2></div>
              <div className="list">
                {committee.map((u) => (
                  <div key={u.id} className="li tap" onClick={() => setOpen(u)}>
                    <Avatar name={u.name} />
                    <div className="grow">
                      <p className="h4">{u.name}</p>
                      <p className="tiny" style={{ marginTop: 2 }}>
                        {[u.designation || "Committee member", u.flat].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <Badge>{u.role}</Badge>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="sect"><h2 className="h2">Residents ({residents.length})</h2></div>
          {people.length === 0 ? (
            <Empty icon={Icons.Users} title="Nobody in the directory yet"
              note="Residents appear here once they register against a flat and the committee approves them." />
          ) : (
            <>
              <SearchBar value={q} onChange={setQ} placeholder="Search name or flat…" />
              {blocks.length > 1 && (
                <Chips value={block} onChange={setBlock}
                  options={[{ value: "all", label: "All blocks" }, ...blocks.map((b) => ({ value: b, label: `Block ${b}` }))]} />
              )}
              <div className="list">
                {residents.slice(0, 60).map((u) => (
                  <div key={u.id} className="li tap" onClick={() => setOpen(u)}>
                    <Avatar name={u.name} />
                    <div className="grow">
                      <p className="h4">{u.name}</p>
                      <p className="tiny" style={{ marginTop: 2 }}>
                        {[u.flat && `Flat ${u.flat}`, u.relation || "resident"].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <Icons.Fwd size={15} style={{ color: "var(--ink-4)" }} />
                  </div>
                ))}
                {!residents.length && <Empty icon={Icons.Users} title="No residents match" />}
              </div>
              {residents.length > 60 && (
                <p className="hint center">Showing the first 60 of {residents.length}. Refine your search to see more.</p>
              )}
            </>
          )}
        </>
      )}

      {open && <PersonSheet u={open} people={people} onClose={() => setOpen(null)} />}
    </>
  );
}

function PersonSheet({ u, people, onClose }) {
  /* Whether the contact is shown was decided before this reached the browser;
     the sheet reports that decision rather than re-deriving it from a
     preference that never meant consent. */
  const shared = !u.contactHidden;
  const family = people.filter((x) => u.flat && x.flat === u.flat && x.id !== u.id);

  return (
    <Sheet title={u.name} onClose={onClose}>
      <div className="center" style={{ marginBottom: 16 }}>
        <Avatar name={u.name} size="lg" />
        <p className="h3" style={{ marginTop: 10 }}>{u.name}</p>
        <p className="tiny">
          {[u.designation || u.relation || "Resident", u.flat && `Flat ${u.flat}`].filter(Boolean).join(" · ")}
        </p>
      </div>

      <div className="card flat">
        {u.flat && (
          <>
            <div className="row"><span className="muted">Flat</span><b>{u.flat}</b></div>
            <div className="hairline" />
          </>
        )}
        {u.joined && (
          <>
            <div className="row"><span className="muted">Resident since</span><b>{fmtDate(u.joined)}</b></div>
            <div className="hairline" />
          </>
        )}
        <div className="row">
          <span className="muted">Phone</span>
          <b>{u.phone || "—"}</b>
        </div>
        {shared && u.email && (
          <>
            <div className="hairline" />
            <div className="row">
              <span className="muted">Email</span>
              <b className="truncate" style={{ maxWidth: 180 }}>{u.email}</b>
            </div>
          </>
        )}
      </div>

      {!shared && (
        <p className="hint" style={{ marginTop: -4 }}>
          {u.name.split(" ")[0]} has not shared their contact details in the directory.
        </p>
      )}

      {family.length > 0 && (
        <>
          <p className="h4" style={{ margin: "6px 0 8px" }}>Also in this flat</p>
          <div className="list">
            {family.map((x) => (
              <div key={x.id} className="li">
                <Avatar name={x.name} />
                <div className="grow"><p className="h4">{x.name}</p><p className="tiny">{x.relation}</p></div>
              </div>
            ))}
          </div>
        </>
      )}

      {shared && u.phone && (
        <a className="btn block" href={`tel:${u.phone}`} style={{ textDecoration: "none", marginTop: 12 }}>
          <Icons.Phone size={16} /> Call {u.name.split(" ")[0]}
        </a>
      )}
    </Sheet>
  );
}

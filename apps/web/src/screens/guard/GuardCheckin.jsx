import { useMemo, useState } from "react";
import Icons from "../../icons";
import { Badge, Btn, Empty, Stat, Segmented, SearchBar, Sheet, Alert, Input, SkeletonList } from "../../components/ui";
import { HelpRow } from "../../components/entities";
import { useGates } from "../../data/gates";
import { useHelp } from "../../data/help";
import { dayKey } from "../../lib/format";

/** Biometric / QR check-in desk for maids, cooks, drivers and society staff. */
export default function GuardCheckin() {
  const { gates } = useGates();
  const { help, attendance, loading, error, refetch, check, byCard } = useHelp();
  const [tab, setTab] = useState("in");
  const [q, setQ] = useState("");
  const [scan, setScan] = useState(false);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return help.filter((h) =>
      (tab === "all" || h.status === tab) &&
      (!t || h.name.toLowerCase().includes(t) || h.role.toLowerCase().includes(t) || h.flats.join(" ").toLowerCase().includes(t))
    );
  }, [help, tab, q]);

  const inCount = help.filter((h) => h.status === "in").length;
  const today = attendance.filter((a) => a.date === dayKey());
  const bio = help.filter((h) => h.biometric).length;

  return (
    <>
      <div className="grid3">
        <Stat value={inCount} label="Inside now" color="var(--green)" />
        <Stat value={today.length} label="Today's entries" color="var(--blue)" />
        <Stat value={`${bio}/${help.length}`} label="Biometric" color="var(--brand)" />
      </div>

      <div className="grid2" style={{ marginTop: 12, marginBottom: 4 }}>
        <Btn icon={Icons.Finger} onClick={() => setScan("bio")}>Biometric scan</Btn>
        <Btn variant="ghost" icon={Icons.QR} onClick={() => setScan("qr")}>Scan staff card</Btn>
      </div>

      <Alert kind="info">Fingerprint and face entry is included at no extra cost on all {gates.length} gate devices. Every check-in writes an attendance row the resident can see.</Alert>

      <SearchBar value={q} onChange={setQ} placeholder="Search name, role or flat…" />
      <Segmented value={tab} onChange={setTab} options={[
        { value: "in", label: `Inside (${inCount})` },
        { value: "out", label: "Outside" },
        { value: "all", label: "All staff" },
      ]} />

      {error && (
        <Alert kind="err" icon={Icons.AlertTri}>
          {error.message}{" "}
          <button className="linkbtn" style={{ color: "inherit", textDecoration: "underline" }} onClick={refetch}>Retry</button>
        </Alert>
      )}

      {loading ? <SkeletonList rows={4} /> : (
        <div className="list">
          {list.map((h) => (
            <HelpRow key={h.id} h={h} right={
              h.status === "in"
                ? <Btn size="sm" variant="ghost" onClick={() => check(h, "out", "manual")}>Check out</Btn>
                : <Btn size="sm" onClick={() => check(h, "in", "manual")}>Check in</Btn>
            } />
          ))}
          {!list.length && <Empty icon={Icons.Users} title="No staff match that search" />}
        </div>
      )}

      {scan && (
        <ScanSheet mode={scan} help={help} onCheck={check} onCard={byCard} onClose={() => setScan(false)} />
      )}
    </>
  );
}

function ScanSheet({ mode, help, onCheck, onCard, onClose }) {
  const [code, setCode] = useState("");
  const [state, setState] = useState("idle");
  const [err, setErr] = useState("");

  const finish = async (h, how) => {
    const res = await onCheck(h, h.status === "in" ? "out" : "in", how);
    if (res?.ok === false) { setErr(res.error?.message || "Could not record that"); setState("idle"); return; }
    onClose();
  };

  /* Stands in for a real reader: no fingerprint hardware here, so it picks one
     of the enrolled staff. The check-in it produces is the real one. */
  const bioScan = () => {
    setState("scanning");
    setTimeout(() => {
      const candidates = help.filter((h) => h.biometric);
      const h = candidates[Math.floor(Math.random() * candidates.length)];
      if (!h) { setErr("No biometric records enrolled."); setState("idle"); return; }
      finish(h, "biometric");
    }, 1100);
  };

  /* Resolved by the server: the card code is a credential, and the desk should
     not be matching it against a list the browser happens to be holding. */
  const cardScan = async () => {
    setState("scanning");
    const res = await onCard(code);
    setState("idle");
    if (!res.ok) return setErr(res.error?.message || "No staff card matches that code.");
    finish(res.help, "qr");
  };

  return (
    <Sheet title={mode === "bio" ? "Biometric entry" : "Scan staff card"} onClose={onClose}>
      {mode === "bio" ? (
        <>
          <div className="card center" style={{ padding: 30 }}>
            <Icons.Finger size={62} style={{ color: state === "scanning" ? "var(--green)" : "var(--brand)", animation: state === "scanning" ? "pulse .8s infinite" : "none" }} />
            <p className="muted" style={{ marginTop: 12 }}>
              {state === "scanning" ? "Reading fingerprint…" : "Ask the staff member to place their finger on the reader, or step in front of the face camera."}
            </p>
          </div>
          {err && <p className="err">{err}</p>}
          <Btn block icon={Icons.Finger} onClick={bioScan} disabled={state === "scanning"}>
            {state === "scanning" ? "Scanning…" : "Start scan"}
          </Btn>
        </>
      ) : (
        <>
          <div className="card center" style={{ padding: 22 }}>
            <Icons.QR size={48} style={{ color: "var(--brand)" }} />
            <p className="muted" style={{ marginTop: 10 }}>Scan the QR on the staff card, or key in the 6-character code.</p>
          </div>
          <Input label="Card code" value={code} maxLength={6} onChange={(e) => { setCode(e.target.value.toUpperCase()); setErr(""); }} placeholder="e.g. R7QK43" />
          {err && <p className="err" style={{ marginBottom: 10 }}>{err}</p>}
          <Btn block icon={Icons.Check} disabled={state === "scanning" || !code.trim()} onClick={cardScan}>
            {state === "scanning" ? "Checking…" : "Verify card"}
          </Btn>
          {help[0]?.cardCode && (
            <p className="hint" style={{ textAlign: "center", marginTop: 10 }}>
              Tip: any card code from the staff list works — e.g. {help[0].cardCode}.
            </p>
          )}
        </>
      )}
    </Sheet>
  );
}

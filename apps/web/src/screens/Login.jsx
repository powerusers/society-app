import { useEffect, useState } from "react";
import Icons from "../icons";
import { Btn, Input, Select, Alert, SearchBar, SkeletonList } from "../components/ui";
import { useApp } from "../store";
import Setup from "./Setup";
import { api, isLive } from "../lib/api";
import { iso } from "../lib/format";

const DEMOS = [
  { id: "u_res", label: "Resident", icon: Icons.Home, desc: "Rahul Mehta · A-401" },
  { id: "u_com", label: "Committee", icon: Icons.Users, desc: "Meena Patil · Treasurer" },
  { id: "u_adm", label: "Admin", icon: Icons.Shield, desc: "Suresh Joshi · Secretary" },
  { id: "u_grd", label: "Guard", icon: Icons.Gate, desc: "Mohan Singh · Main Gate" },
  { id: "u_stf", label: "Staff", icon: Icons.Tools, desc: "Ganesh Rane · Manager" },
];

export default function Login() {
  const { db, login, live } = useApp();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr("");
    if (!live) {
      const u = db.users.find((x) => x.email?.toLowerCase() === email.trim().toLowerCase());
      if (!u) return setErr("No account found for that email. Use a demo login below.");
      if (u.status !== "active") return setErr("This account is awaiting committee approval.");
      return login(u.id);
    }
    if (!email.trim() || !pw) return setErr("Enter your email and password");

    setBusy(true);
    const res = await login(email.trim(), pw);
    setBusy(false);
    if (!res.ok) setErr(res.error?.message || "Could not sign in");
  };

  if (mode === "register") return <Register onBack={() => setMode("login")} />;
  if (mode === "setup") return <Setup onDone={() => setMode("login")} onBack={() => setMode("login")} />;

  return (
    <div className="app" style={{ background: "linear-gradient(165deg,var(--b700) 0%,var(--b800) 55%,var(--b900) 100%)", padding: "48px 20px 36px" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ width: 62, height: 62, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.14)", borderRadius: "var(--r-lg)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Icons.Building size={28} style={{ color: "#fff" }} />
        </div>
        <h1 className="h1" style={{ color: "#fff" }}>{db.settings.societyName}</h1>
        <p style={{ color: "rgba(255,255,255,.55)", fontSize: 13, margin: "6px 0 0" }}>Gate · Community · Accounts, in one app</p>
      </div>

      <div className="card">
        <h2 className="h3" style={{ marginBottom: 16 }}>Sign in</h2>
        <Input label="Email" type="email" value={email} placeholder="you@greenvalley.in" autoComplete="username"
          onChange={(e) => { setEmail(e.target.value); setErr(""); }}
          onKeyDown={(e) => e.key === "Enter" && submit()} />
        <div style={{ position: "relative" }}>
          <Input label="Password" type={showPw ? "text" : "password"} value={pw} placeholder="Enter password"
            autoComplete="current-password"
            onChange={(e) => { setPw(e.target.value); setErr(""); }}
            onKeyDown={(e) => e.key === "Enter" && submit()} />
          <button onClick={() => setShowPw(!showPw)} aria-label="Toggle password"
            style={{ position: "absolute", right: 11, top: 30, border: "none", background: "none", color: "var(--ink-4)" }}>
            <Icons.Eye size={17} />
          </button>
        </div>
        {err && <p className="err" style={{ marginBottom: 10 }}>{err}</p>}
        <Btn block onClick={submit} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Btn>
        <p className="muted" style={{ textAlign: "center", marginTop: 14 }}>
          New resident? <button className="linkbtn" onClick={() => setMode("register")}>Register your flat</button>
        </p>
        {/* Once a society exists the setup screen stops appearing on its own,
            so onboarding the next one needs a way in. It still asks for the
            token, which is what actually gates it. */}
        {live && (
          <p className="muted" style={{ textAlign: "center", marginTop: 8 }}>
            Bringing a new society on board?{" "}
            <button className="linkbtn" onClick={() => setMode("setup")}>Set it up</button>
          </p>
        )}
      </div>

      {/* Demo shortcuts exist only in the no-API build — a live deployment must
          not advertise working credentials on its sign-in screen. */}
      {!live && (
        <>
          <p style={{ textAlign: "center", fontSize: 10, color: "rgba(255,255,255,.4)", margin: "24px 0 12px", textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600 }}>
            Quick demo access
          </p>
          <div style={{ display: "grid", gap: 7 }}>
            {DEMOS.map((d) => (
              <button key={d.id} onClick={() => login(d.id)}
                style={{ padding: "11px 12px", borderRadius: "var(--r-md)", border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.07)", display: "flex", alignItems: "center", gap: 11, textAlign: "left" }}>
                <div style={{ width: 34, height: 34, borderRadius: "var(--r-sm)", background: "rgba(255,255,255,.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <d.icon size={17} style={{ color: "rgba(255,255,255,.85)" }} />
                </div>
                <div className="grow">
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#fff", display: "block" }}>{d.label}</span>
                  <span style={{ fontSize: 11.5, color: "rgba(255,255,255,.5)" }}>{d.desc}</span>
                </div>
                <Icons.Fwd size={15} style={{ color: "rgba(255,255,255,.32)" }} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Register({ onBack }) {
  const { db, add, say, live } = useApp();
  const [f, setF] = useState({ name: "", block: "A", flatNo: "", relation: "owner", phone: "", email: "", password: "" });
  const u = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [err, setErr] = useState("");
  const [fieldErr, setFieldErr] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  /* One deployment serves many societies, so the applicant has to say which
     one — it decides both which flat register their code is checked against
     and which committee is asked to approve them. */
  const [societies, setSocieties] = useState([]);
  const [societyId, setSocietyId] = useState("");
  const [q, setQ] = useState("");
  const [loadingSocieties, setLoadingSocieties] = useState(live);

  useEffect(() => {
    if (!live) return;
    let alive = true;
    setLoadingSocieties(true);
    const t = setTimeout(() => {
      api.societies(q)
        .then((r) => { if (alive) setSocieties(r.societies || []); })
        .catch(() => { if (alive) setSocieties([]); })
        .finally(() => { if (alive) setLoadingSocieties(false); });
    }, q ? 250 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [live, q]);

  const chosen = societies.find((s) => s.id === societyId);
  /* Blocks belong to the chosen society's register, so the dropdown cannot be
     filled until one is chosen. Free text is the honest control until then. */
  const blocks = live ? [] : (db.settings.blocks || ["A", "B", "C", "D", "E"]);

  const submit = async () => {
    setErr(""); setFieldErr({});
    const flatCode = `${f.block.trim().toUpperCase()}-${f.flatNo.trim()}`;
    const payload = { name: f.name.trim(), societyId, flatCode, relation: f.relation, phone: f.phone, email: f.email, password: f.password };
    if (live && !societyId) return setErr("Choose your society first");

    if (!live) {
      if (!payload.name) return setErr("Enter your full name");
      if (!db.flats.some((x) => x.code === flatCode)) return setErr(`Flat ${flatCode} is not on the society's flat list`);
      if (!/^\d{10}$/.test(f.phone)) return setErr("Enter a valid 10-digit mobile number");
      if (!/^\S+@\S+\.\S+$/.test(f.email)) return setErr("Enter a valid email address");
      if (f.password.length < 8) return setErr("Password must be at least 8 characters");
      add("registrations", { ...payload, status: "pending", at: iso(), docs: [] });
      say("Registration submitted — the committee will verify and approve.");
      return onBack();
    }

    setBusy(true);
    try {
      await api.register(payload);
      setDone(true);
    } catch (e) {
      if (e.fieldErrors) setFieldErr(e.fieldErrors);
      else setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <div className="hdr">
        <div className="hdr-row">
          <button className="iconbtn ghost" onClick={onBack}><Icons.Back size={20} /></button>
          <h1 className="grow">Register your flat</h1>
        </div>
      </div>
      <div className="body">
        {done ? (
          <>
            <Alert kind="ok" icon={Icons.CheckCircle}>
              Registration submitted. The committee will verify your documents and approve access — you will be able to sign in once they do.
            </Alert>
            <Btn block onClick={onBack}>Back to sign in</Btn>
          </>
        ) : (
          <>
            <Alert kind="info">
              Your details are verified against the society's flat register before approval. Owners are asked for the sale deed; tenants for a rent agreement and police verification.
            </Alert>
            {live && (
              <div className="card">
                <p className="h4" style={{ marginBottom: 4 }}>Your society</p>
                <p className="tiny" style={{ marginBottom: 10 }}>
                  Your application goes to this society's committee for approval.
                </p>
                <SearchBar value={q} onChange={setQ} placeholder="Search by name or address…" />
                {loadingSocieties ? <SkeletonList rows={2} /> : (
                  <div className="list">
                    {societies.map((s) => (
                      <div key={s.id} className={`li tap${s.id === societyId ? " on" : ""}`}
                        onClick={() => { setSocietyId(s.id); setErr(""); }}>
                        <div className="grow">
                          <p className="h4">{s.name}</p>
                          {s.address && <p className="tiny" style={{ marginTop: 3 }}>{s.address}</p>}
                        </div>
                        {s.id === societyId
                          ? <Icons.CheckCircle size={18} style={{ color: "var(--accent)" }} />
                          : <span style={{ width: 18 }} />}
                      </div>
                    ))}
                    {!societies.length && (
                      <div className="li">
                        <p className="tiny">
                          {q ? `No society matches "${q}".` : "No societies are set up on this platform yet."}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="card">
              <Input label="Full name" value={f.name} error={fieldErr.name} onChange={(e) => u("name", e.target.value)} placeholder="e.g. Rahul Mehta" />
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  {blocks.length ? (
                    <Select label="Block" value={f.block} onChange={(e) => u("block", e.target.value)}
                      options={blocks.map((b) => ({ value: b, label: `Block ${b}` }))} />
                  ) : (
                    <Input label="Block" value={f.block} maxLength={2} error={fieldErr.flatCode}
                      onChange={(e) => u("block", e.target.value.replace(/[^A-Za-z]/g, "").toUpperCase())}
                      placeholder="e.g. C" />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <Input label="Flat no." value={f.flatNo} error={fieldErr.flatCode} onChange={(e) => u("flatNo", e.target.value)} placeholder="e.g. 401 or 1003" />
                </div>
              </div>
              {chosen && (
                <p className="hint" style={{ marginTop: -4 }}>
                  Checked against the flat register for {chosen.name}.
                </p>
              )}
              <Select label="I am the" value={f.relation} onChange={(e) => u("relation", e.target.value)}
                options={[{ value: "owner", label: "Owner" }, { value: "co-owner", label: "Co-owner / family" }, { value: "tenant", label: "Tenant" }]} />
              <Input label="Mobile" type="tel" maxLength={10} value={f.phone} error={fieldErr.phone}
                onChange={(e) => u("phone", e.target.value.replace(/\D/g, ""))} placeholder="10-digit number" />
              <Input label="Email" type="email" value={f.email} error={fieldErr.email} onChange={(e) => u("email", e.target.value)} placeholder="you@email.com" />
              <Input label="Password" type="password" value={f.password} error={fieldErr.password} onChange={(e) => u("password", e.target.value)} placeholder="Minimum 8 characters" />
              {err && <p className="err" style={{ marginBottom: 10 }}>{err}</p>}
              <Btn block onClick={submit} disabled={busy}>{busy ? "Submitting…" : "Submit for approval"}</Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

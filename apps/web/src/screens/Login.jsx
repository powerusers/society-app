import { useState } from "react";
import Icons from "../icons";
import { Btn, Input, Select, Alert } from "../components/ui";
import { useApp } from "../store";
import { iso } from "../lib/format";

const DEMOS = [
  { id: "u_res", label: "Resident", icon: Icons.Home, desc: "Rahul Mehta · A-401" },
  { id: "u_com", label: "Committee", icon: Icons.Users, desc: "Meena Patil · Treasurer" },
  { id: "u_adm", label: "Admin", icon: Icons.Shield, desc: "Suresh Joshi · Secretary" },
  { id: "u_grd", label: "Guard", icon: Icons.Gate, desc: "Mohan Singh · Main Gate" },
  { id: "u_stf", label: "Staff", icon: Icons.Tools, desc: "Ganesh Rane · Manager" },
];

export default function Login() {
  const { db, login, add, say } = useApp();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");

  const submit = () => {
    const u = db.users.find((x) => x.email?.toLowerCase() === email.trim().toLowerCase());
    if (!u) return setErr("No account found for that email. Use a demo login below.");
    if (u.status !== "active") return setErr("This account is awaiting committee approval.");
    login(u.id);
  };

  if (mode === "register") return <Register onBack={() => setMode("login")} add={add} say={say} flats={db.flats} />;

  return (
    <div className="app" style={{ background: "linear-gradient(180deg,#1B4D3E 0%,#2D7A5F 42%,#F8F6F1 100%)", padding: "44px 20px 32px" }}>
      <div style={{ textAlign: "center", marginBottom: 26 }}>
        <div style={{ width: 70, height: 70, background: "rgba(255,255,255,.16)", borderRadius: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
          <Icons.Building size={34} style={{ color: "#fff" }} />
        </div>
        <h1 style={{ color: "#fff", fontSize: 25, fontWeight: 800, margin: "0 0 4px", letterSpacing: "-.5px" }}>{db.settings.societyName}</h1>
        <p style={{ color: "rgba(255,255,255,.72)", fontSize: 13, margin: 0 }}>Gate · Community · Accounts, in one app</p>
      </div>

      <div className="card">
        <h2 className="h2" style={{ marginBottom: 14 }}>Sign in</h2>
        <Input label="Email" type="email" value={email} placeholder="you@greenvalley.in"
          onChange={(e) => { setEmail(e.target.value); setErr(""); }} />
        <div style={{ position: "relative" }}>
          <Input label="Password" type={showPw ? "text" : "password"} value={pw} placeholder="Enter password"
            onChange={(e) => setPw(e.target.value)} />
          <button onClick={() => setShowPw(!showPw)} aria-label="Toggle password"
            style={{ position: "absolute", right: 12, top: 32, border: "none", background: "none", cursor: "pointer", color: "var(--ink3)" }}>
            <Icons.Eye size={17} />
          </button>
        </div>
        {err && <p className="err" style={{ marginBottom: 10 }}>{err}</p>}
        <Btn block onClick={submit}>Sign in</Btn>
        <p className="muted" style={{ textAlign: "center", marginTop: 14 }}>
          New resident? <button className="linkbtn" onClick={() => setMode("register")}>Register your flat</button>
        </p>
      </div>

      <p style={{ textAlign: "center", fontSize: 10.5, color: "rgba(255,255,255,.65)", margin: "20px 0 10px", textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700 }}>
        Quick demo access
      </p>
      <div style={{ display: "grid", gap: 8 }}>
        {DEMOS.map((d) => (
          <button key={d.id} onClick={() => login(d.id)}
            style={{ padding: "12px 13px", borderRadius: 13, border: "1.5px solid rgba(255,255,255,.22)", background: "rgba(255,255,255,.1)", cursor: "pointer", display: "flex", alignItems: "center", gap: 11, textAlign: "left", backdropFilter: "blur(6px)" }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: "rgba(255,255,255,.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <d.icon size={19} style={{ color: "#fff" }} />
            </div>
            <div className="grow">
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "#fff", display: "block" }}>{d.label}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,.66)" }}>{d.desc}</span>
            </div>
            <Icons.Fwd size={16} style={{ color: "rgba(255,255,255,.5)" }} />
          </button>
        ))}
      </div>
    </div>
  );
}

function Register({ onBack, add, say, flats }) {
  const [f, setF] = useState({ name: "", block: "A", flatNo: "", relation: "owner", phone: "", email: "", password: "" });
  const u = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [err, setErr] = useState("");

  const submit = () => {
    const code = `${f.block}-${f.flatNo}`;
    if (!f.name.trim()) return setErr("Enter your full name");
    if (!flats.some((x) => x.code === code)) return setErr(`Flat ${code} is not on the society's flat list`);
    if (!/^\d{10}$/.test(f.phone)) return setErr("Enter a valid 10-digit mobile number");
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return setErr("Enter a valid email address");
    if (f.password.length < 8) return setErr("Password must be at least 8 characters");
    add("registrations", {
      name: f.name.trim(), flatCode: code, relation: f.relation, phone: f.phone, email: f.email,
      status: "pending", at: iso(), docs: [],
    });
    say("Registration submitted — the committee will verify and approve.");
    onBack();
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
        <Alert kind="info">Your details are verified against the society's flat register before approval. Owners are asked for the sale deed; tenants for a rent agreement and police verification.</Alert>
        <div className="card">
          <Input label="Full name" value={f.name} onChange={(e) => u("name", e.target.value)} placeholder="e.g. Rahul Mehta" />
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Select label="Block" value={f.block} onChange={(e) => u("block", e.target.value)}
                options={["A", "B", "C", "D", "E"].map((b) => ({ value: b, label: `Block ${b}` }))} />
            </div>
            <div style={{ flex: 1 }}>
              <Input label="Flat no." value={f.flatNo} onChange={(e) => u("flatNo", e.target.value)} placeholder="e.g. 401" />
            </div>
          </div>
          <Select label="I am the" value={f.relation} onChange={(e) => u("relation", e.target.value)}
            options={[{ value: "owner", label: "Owner" }, { value: "co-owner", label: "Co-owner / family" }, { value: "tenant", label: "Tenant" }]} />
          <Input label="Mobile" type="tel" maxLength={10} value={f.phone} onChange={(e) => u("phone", e.target.value.replace(/\D/g, ""))} placeholder="10-digit number" />
          <Input label="Email" type="email" value={f.email} onChange={(e) => u("email", e.target.value)} placeholder="you@email.com" />
          <Input label="Password" type="password" value={f.password} onChange={(e) => u("password", e.target.value)} placeholder="Minimum 8 characters" />
          {err && <p className="err" style={{ marginBottom: 10 }}>{err}</p>}
          <Btn block onClick={submit}>Submit for approval</Btn>
        </div>
      </div>
    </div>
  );
}

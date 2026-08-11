import { useState } from "react";
import Icons from "../icons";
import { Btn, Input, Alert } from "../components/ui";
import { useApp } from "../store";
import { api } from "../lib/api";

/**
 * First run: this instance has a database and no society in it.
 *
 * Shown instead of the sign-in form when the API reports `needsSetup`, because
 * there is nothing to sign in to yet — no society, no flats, and no account
 * that could approve one.
 */
export default function Setup({ onDone }) {
  const { refreshMe } = useApp();
  const [f, setF] = useState({
    name: "", address: "", regNo: "", gstin: "",
    adminName: "", email: "", phone: "", password: "", designation: "Secretary",
  });
  const u = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [token, setToken] = useState("");
  const [err, setErr] = useState("");
  const [fieldErr, setFieldErr] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(""); setFieldErr({});
    if (!token.trim()) return setErr("Enter the setup token from the API environment");

    setBusy(true);
    try {
      await api.setup({
        society: {
          name: f.name.trim(), address: f.address.trim(),
          regNo: f.regNo.trim(), gstin: f.gstin.trim().toUpperCase(),
        },
        admin: {
          name: f.adminName.trim(), email: f.email.trim(), phone: f.phone,
          password: f.password, designation: f.designation.trim(),
        },
      }, token.trim());
      /* api.setup stores the tokens, but the store holds the session the rest
         of the app reads. Without this the new administrator is authenticated
         and still looking at a sign-in screen. */
      await refreshMe();
      onDone();
    } catch (e) {
      /* Server field paths are "admin.password"; the inputs are flat. */
      if (e.fieldErrors) {
        setFieldErr(Object.fromEntries(
          Object.entries(e.fieldErrors).map(([k, v]) => [k.split(".").pop(), v]),
        ));
        setErr("Check the highlighted fields");
      } else setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <div className="hdr">
        <div className="hdr-row"><h1 className="grow">Set up your society</h1></div>
      </div>
      <div className="body">
        <Alert kind="info" icon={Icons.Info}>
          This database has no society yet. What you enter here creates it, along with the
          first administrator account — the one that approves everyone else.
        </Alert>

        <p className="h4" style={{ margin: "4px 0 8px" }}>The society</p>
        <div className="card">
          <Input label="Society name" value={f.name} error={fieldErr.name}
            onChange={(e) => u("name", e.target.value)} placeholder="e.g. Sunrise Residency" />
          <Input label="Address" value={f.address} onChange={(e) => u("address", e.target.value)}
            placeholder="Street, area, city and PIN" />
          <Input label="Registration number" value={f.regNo} hint="From the society's registration certificate. Appears on every bill."
            onChange={(e) => u("regNo", e.target.value)} placeholder="Optional" />
          <Input label="GSTIN" value={f.gstin} error={fieldErr.gstin} hint="Only if the society is GST registered."
            onChange={(e) => u("gstin", e.target.value.toUpperCase())} placeholder="Optional" />
        </div>

        <p className="h4" style={{ margin: "14px 0 8px" }}>Your administrator account</p>
        <div className="card">
          <Input label="Full name" value={f.adminName} error={fieldErr.name}
            onChange={(e) => u("adminName", e.target.value)} placeholder="e.g. Nikhil Misal" />
          <Input label="Designation" value={f.designation} onChange={(e) => u("designation", e.target.value)}
            placeholder="Secretary" />
          <Input label="Email" type="email" value={f.email} error={fieldErr.email}
            onChange={(e) => u("email", e.target.value)} placeholder="you@example.com" />
          <Input label="Mobile" type="tel" maxLength={10} value={f.phone} error={fieldErr.phone}
            onChange={(e) => u("phone", e.target.value.replace(/\D/g, ""))} placeholder="10-digit number" />
          <Input label="Password" type="password" value={f.password} error={fieldErr.password}
            hint="At least 12 characters. This account can see every flat's dues and approve every resident."
            onChange={(e) => u("password", e.target.value)} placeholder="Minimum 12 characters" />
        </div>

        <p className="h4" style={{ margin: "14px 0 8px" }}>Setup token</p>
        <div className="card">
          <Input label="Token" value={token} onChange={(e) => setToken(e.target.value)}
            hint="The SETUP_TOKEN set in the API environment. It proves you run this deployment — without it, whoever found this page first would become its administrator."
            placeholder="Paste the token" />
        </div>

        {err && <p className="err" style={{ margin: "12px 0" }}>{err}</p>}
        <Btn block style={{ marginTop: 12 }} disabled={busy} onClick={submit}>
          {busy ? "Creating…" : "Create society and sign in"}
        </Btn>
        <p className="hint center" style={{ marginTop: 10 }}>
          You can import the flat register straight afterwards, from Admin › Flat register.
        </p>
      </div>
    </div>
  );
}

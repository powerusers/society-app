import { useEffect, useRef, useState } from "react";
import Icons from "../icons";
import { avatarColor } from "../styles";
import { initials } from "../lib/format";

export const Btn = ({ variant, size, block, icon: I, children, className = "", ...p }) => (
  <button
    className={["btn", variant || "", size || "", block ? "block" : "", className].filter(Boolean).join(" ")}
    {...p}
  >
    {I && <I size={size === "sm" ? 15 : 17} />}
    {children}
  </button>
);

export const Badge = ({ color, children, className = "" }) => (
  <span className={`badge ${color || ""} ${className}`}>{children}</span>
);

export const Card = ({ as: Tag = "div", className = "", children, ...p }) => (
  <Tag className={`card ${className}`} {...p}>{children}</Tag>
);

export const Section = ({ title, action, children }) => (
  <>
    <div className="sect">
      <h2 className="h2">{title}</h2>
      {action}
    </div>
    {children}
  </>
);

export const Field = ({ label, hint, error, children }) => (
  <div className="field">
    {label && <label>{label}</label>}
    {children}
    {hint && !error && <p className="hint">{hint}</p>}
    {error && <p className="err">{error}</p>}
  </div>
);

export const Input = ({ label, hint, error, ...p }) => (
  <Field label={label} hint={hint} error={error}><input className="inp" {...p} /></Field>
);

export const TextArea = ({ label, hint, error, ...p }) => (
  <Field label={label} hint={hint} error={error}><textarea className="inp" {...p} /></Field>
);

export const Select = ({ label, hint, error, options = [], ...p }) => (
  <Field label={label} hint={hint} error={error}>
    <select className="inp" {...p}>
      {options.map((o) => (
        typeof o === "string"
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </Field>
);

export const Toggle = ({ on, onChange, label, desc }) => (
  <div className="row" style={{ padding: "9px 0" }}>
    <div className="grow">
      <p className="h4">{label}</p>
      {desc && <p className="tiny" style={{ marginTop: 2 }}>{desc}</p>}
    </div>
    <button className={`switch ${on ? "on" : ""}`} onClick={() => onChange(!on)} aria-label={label}><i /></button>
  </div>
);

export const Segmented = ({ value, onChange, options }) => (
  <div className="seg">
    {options.map((o) => {
      const v = typeof o === "string" ? o : o.value;
      const l = typeof o === "string" ? o : o.label;
      return <button key={v} className={value === v ? "on" : ""} onClick={() => onChange(v)}>{l}</button>;
    })}
  </div>
);

export const Chips = ({ value, onChange, options }) => (
  <div className="chiprow">
    {options.map((o) => {
      const v = typeof o === "string" ? o : o.value;
      const l = typeof o === "string" ? o : o.label;
      return <button key={v} className={`chip ${value === v ? "on" : ""}`} onClick={() => onChange(v)}>{l}</button>;
    })}
  </div>
);

export const Avatar = ({ name, size, emoji, color }) => (
  <div className={`avatar ${size === "lg" ? "lg" : ""}`} style={{ background: color || avatarColor(name) }}>
    {emoji || initials(name)}
  </div>
);

export const Stat = ({ value, label, color, onClick }) => (
  <div className="stat" onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
    <p className="num" style={{ color: color || "var(--ink)" }}>{value}</p>
    <p className="lbl">{label}</p>
  </div>
);

export const Alert = ({ kind = "info", icon: I = Icons.Info, children }) => (
  <div className={`alert ${kind}`}>
    <I size={17} style={{ marginTop: 1 }} />
    <span className="grow">{children}</span>
  </div>
);

export const Empty = ({ icon: I = Icons.Box, title, note, action }) => (
  <div className="card empty">
    <I size={34} style={{ color: "var(--line2)", marginBottom: 8 }} />
    <p className="h4">{title}</p>
    {note && <p className="tiny" style={{ marginTop: 4 }}>{note}</p>}
    {action && <div style={{ marginTop: 14 }}>{action}</div>}
  </div>
);

export const Bar = ({ value, max, color }) => (
  <div className="bar"><i style={{ width: `${Math.min(100, max ? (value / max) * 100 : 0)}%`, background: color }} /></div>
);

export const Sheet = ({ title, onClose, children, footer }) => {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="sheet">
        <div className="sheet-hd">
          <h3>{title}</h3>
          <button className="x" onClick={onClose} aria-label="Close"><Icons.X size={16} /></button>
        </div>
        {children}
        {footer}
      </div>
    </div>
  );
};

export const Confirm = ({ title, body, confirmLabel = "Confirm", danger, onConfirm, onClose }) => (
  <Sheet title={title} onClose={onClose}>
    <p className="muted" style={{ marginBottom: 18 }}>{body}</p>
    <div style={{ display: "flex", gap: 9 }}>
      <Btn variant="ghost" block onClick={onClose}>Cancel</Btn>
      <Btn variant={danger ? "danger" : ""} block onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Btn>
    </div>
  </Sheet>
);

export const Toast = ({ toast, onHide }) => {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onHide, 2600);
    return () => clearTimeout(t);
  }, [toast, onHide]);
  if (!toast) return null;
  return <div className={`toast ${toast.kind || "ok"}`}>{toast.text}</div>;
};

export const SearchBar = ({ value, onChange, placeholder = "Search…" }) => (
  <div style={{ position: "relative", marginBottom: 12 }}>
    <Icons.Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "var(--ink3)" }} />
    <input className="inp" style={{ paddingLeft: 36 }} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  </div>
);

export const Row = ({ icon: I, emoji, avatar, title, sub, meta, right, onClick, badge }) => (
  <div className={`li ${onClick ? "tap" : ""}`} onClick={onClick} role={onClick ? "button" : undefined}>
    {avatar ? <Avatar name={avatar} emoji={emoji} /> : I ? <div className="ico-tile"><I size={19} /></div> : emoji ? <div className="ico-tile" style={{ fontSize: 19 }}>{emoji}</div> : null}
    <div className="grow">
      <p className="h4 truncate">{title}</p>
      {sub && <p className="tiny" style={{ marginTop: 2 }}>{sub}</p>}
      {meta}
    </div>
    {badge}
    {right}
    {onClick && <Icons.Fwd size={15} style={{ color: "var(--ink3)" }} />}
  </div>
);

/** Counts down/up live — used for delivery overstay and SLA timers. */
export const useTick = (ms = 30000) => {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
};

export const useForm = (init) => {
  const [f, set] = useState(init);
  const ref = useRef(init);
  ref.current = f;
  return {
    f,
    set: (k, v) => set((p) => ({ ...p, [k]: v })),
    bind: (k) => ({ value: f[k] ?? "", onChange: (e) => set((p) => ({ ...p, [k]: e.target.value })) }),
    reset: () => set(init),
    all: () => ref.current,
  };
};

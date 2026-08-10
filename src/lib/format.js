export const uid = (p = "id") => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const inr = (n, opts = {}) => {
  const v = Number(n || 0);
  const s = Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: opts.paise ? 2 : 0, minimumFractionDigits: opts.paise ? 2 : 0 });
  return (v < 0 ? "-₹" : "₹") + s;
};

export const lakh = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  if (Math.abs(v) >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`;
  return inr(v);
};

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const iso = (d = new Date()) => new Date(d).toISOString();
export const dayKey = (d = new Date()) => new Date(d).toISOString().slice(0, 10);

export const fmtDate = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;
};

export const fmtShortDate = (v) => {
  const d = new Date(v);
  if (isNaN(d)) return String(v || "—");
  return `${d.getDate()} ${MON[d.getMonth()]}`;
};

export const fmtTime = (v) => {
  const d = v ? new Date(v) : new Date();
  if (isNaN(d)) return String(v);
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
};

export const fmtDateTime = (v) => `${fmtShortDate(v)}, ${fmtTime(v)}`;

export const ago = (v) => {
  const ms = Date.now() - new Date(v).getTime();
  if (isNaN(ms)) return "";
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return fmtShortDate(v);
};

/** "in 42m" / "overdue by 2h" — used for SLA clocks and overstay timers. */
export const until = (v) => {
  const ms = new Date(v).getTime() - Date.now();
  const abs = Math.abs(ms);
  const m = Math.round(abs / 60000);
  const txt = m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
  return { late: ms < 0, txt, ms };
};

export const minsBetween = (a, b = new Date()) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000));

export const cycleLabel = (cycle) => {
  const [y, m] = String(cycle).split("-");
  return `${MON[Number(m) - 1]} ${y}`;
};

/** Add n months to a YYYY-MM cycle string. */
export const shiftCycle = (cycle, n) => {
  const [y, m] = String(cycle).split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const thisCycle = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const initials = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

export const csv = (rows) =>
  rows.map((r) => r.map((c) => {
    const s = c === null || c === undefined ? "" : String(c);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\n");

export const download = (filename, text, mime = "text/csv") => {
  const blob = new Blob([text], { type: `${mime};charset=utf-8;` });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

/** 6-char human-readable code used for gate passes and staff cards. */
export const code6 = () => {
  const A = "ACDEFGHJKLMNPQRTUVWXY3456789";
  return Array.from({ length: 6 }, () => A[Math.floor(Math.random() * A.length)]).join("");
};

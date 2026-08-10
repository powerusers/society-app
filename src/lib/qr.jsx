import { useEffect, useState } from "react";
import QRCodeLib from "qrcode";

/** Renders a scannable QR for gate passes, staff cards and patrol checkpoints. */
export default function QR({ value, size = 168, caption }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let alive = true;
    QRCodeLib.toDataURL(String(value ?? ""), {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#1B4D3E", light: "#FFFFFF" },
    })
      .then((d) => alive && setSrc(d))
      .catch(() => alive && setSrc(""));
    return () => { alive = false; };
  }, [value, size]);

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        width: size, height: size, margin: "0 auto", background: "#fff", borderRadius: 16,
        border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", padding: 8,
      }}>
        {src
          ? <img src={src} alt="QR code" width={size - 16} height={size - 16} style={{ display: "block" }} />
          : <span className="tiny">generating…</span>}
      </div>
      {caption && <p className="mono" style={{ marginTop: 8, fontWeight: 700, color: "var(--brand)", letterSpacing: 2 }}>{caption}</p>}
    </div>
  );
}

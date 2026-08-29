/** Document vault rules, shared so the upload form and the API agree on what is allowed. */

export const DOCUMENT_CATEGORIES = [
  "Meeting minutes", "Legal", "Accounts", "Compliance", "Contracts", "Facilities", "Circulars",
];

export const DOCUMENT_VISIBILITY = ["residents", "committee"];

/**
 * Allowlist, not a blocklist.
 *
 * HTML and SVG are deliberately absent: they execute script when a browser
 * renders them, and a file served from the bucket's own origin would be a
 * stored-XSS vector. Downloads are also forced to `attachment` for the same
 * reason — the allowlist is the first defence, not the only one.
 */
export const ALLOWED_CONTENT_TYPES = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "text/plain": ".txt",
  "text/csv": ".csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "application/msword": ".doc",
  "application/vnd.ms-excel": ".xls",
};

export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

export const isAllowedContentType = (t) => Object.hasOwn(ALLOWED_CONTENT_TYPES, String(t || "").toLowerCase());

/**
 * Extension → content type, for files whose source did not say what they are.
 *
 * Android's document providers are inconsistent: a perfectly ordinary PDF picked
 * from Drive or a file manager frequently arrives as `application/octet-stream`
 * or with no type at all. Refusing those outright means refusing files the vault
 * is meant to hold, so the extension is used as a second opinion — but only ever
 * to land on a type already in the allowlist. An unrecognised extension is still
 * a refusal.
 *
 * This is not a security boundary and is not treated as one. The client's
 * declared content type was never trustworthy — any client can send whatever it
 * likes — so the defences that matter are elsewhere: the server's allowlist, the
 * absence of HTML and SVG from it, and downloads forced to `attachment`.
 */
const EXTENSION_TYPES = Object.entries(ALLOWED_CONTENT_TYPES)
  .reduce((map, [type, ext]) => ({ ...map, [ext]: type }), { ".jpeg": "image/jpeg" });

/** Types a provider uses to mean "I don't know", which the extension may override. */
const VAGUE_TYPES = new Set(["", "application/octet-stream", "binary/octet-stream", "*/*"]);

/**
 * The content type to declare for a picked file.
 *
 * Returns null when neither the reported type nor the extension lands in the
 * allowlist, which the caller should treat as "not accepted".
 */
export function resolveContentType(fileName, reportedType) {
  const reported = String(reportedType || "").toLowerCase().trim();
  if (isAllowedContentType(reported)) return reported;
  if (!VAGUE_TYPES.has(reported)) return null;

  const dot = String(fileName || "").lastIndexOf(".");
  if (dot < 0) return null;
  const ext = String(fileName).slice(dot).toLowerCase();
  return EXTENSION_TYPES[ext] || null;
}

/**
 * Strips anything that could escape the intended prefix or confuse a browser:
 * directory separators, leading dots, control characters and runaway length.
 * The result is only the trailing segment of a key the server builds itself.
 */
export function safeFileName(name, fallback = "document") {
  const base = String(name || "")
    .split(/[/\\]/).pop()                     // drop any path
    .replace(/[\u0000-\u001f\u007f]/g, "")   // control characters
    .replace(/[^A-Za-z0-9._ -]/g, "_")     // anything exotic
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")                   // no leading dots — no ".." and no hidden files
    .trim();

  if (!base || base === ".") return fallback;
  if (base.length <= 120) return base;

  const dot = base.lastIndexOf(".");
  if (dot <= 0) return base.slice(0, 120);
  const ext = base.slice(dot, dot + 12);
  return base.slice(0, 120 - ext.length) + ext;
}

/** Object key. Built from the society, the document's own id and a safe filename. */
export function documentKey({ societyId, documentId, fileName }) {
  return `societies/${societyId}/documents/${documentId}/${safeFileName(fileName)}`;
}

export const humanSize = (bytes) => {
  const n = Number(bytes || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

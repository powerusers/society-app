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

import pg from "pg";
import { config } from "../config.js";

/* numeric/decimal arrives as a string by default; money in this app fits in a
   double comfortably, and every consumer expects a number. */
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => (v === null ? null : Number(v)));
/* DATE should stay a plain YYYY-MM-DD string — turning it into a Date shifts it by
   the server's timezone offset, which silently moves due dates across midnight. */
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);

/**
 * Whether to negotiate TLS for this connection string.
 *
 * A private host speaks plain TCP and will reject an SSL handshake outright
 * ("the server does not support SSL connections"), so asking for TLS there
 * breaks the connection rather than securing it. Anything reached over the
 * public internet gets TLS. `sslmode` in the URL, or PGSSLMODE, overrides
 * the guess in either direction.
 */
export function sslFor(url) {
  let host = "";
  let mode = process.env.PGSSLMODE || "";
  try {
    const u = new URL(url);
    host = u.hostname;
    mode = u.searchParams.get("sslmode") || mode;
  } catch {
    /* An unparseable URL is the pool's problem to report, not ours. */
  }
  if (mode === "disable") return undefined;
  if (mode) return { rejectUnauthorized: false };

  const private_ = host === "localhost" || host === "127.0.0.1" ||
    host.endsWith(".internal") || host.endsWith(".local");
  /* Verification is off because managed providers front Postgres with a
     self-signed cert. That protects against passive sniffing but not an
     active MITM; pinning the provider's CA is the fix if that matters. */
  return private_ ? undefined : { rejectUnauthorized: false };
}

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: sslFor(config.databaseUrl),
});

pool.on("error", (err) => {
  console.error("[db] idle client error", err.message);
});

export const query = (text, params) => pool.query(text, params);

export const one = async (text, params) => (await pool.query(text, params)).rows[0] || null;

export const many = async (text, params) => (await pool.query(text, params)).rows;

/**
 * Runs `fn` inside a transaction, rolling back on any throw.
 * Every multi-table mutation in this API goes through here so a half-written
 * billing run or a payment without its ledger row cannot survive an error.
 */
export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export const closePool = () => pool.end();

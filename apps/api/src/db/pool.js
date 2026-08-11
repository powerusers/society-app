import pg from "pg";
import { config } from "../config.js";

/* numeric/decimal arrives as a string by default; money in this app fits in a
   double comfortably, and every consumer expects a number. */
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => (v === null ? null : Number(v)));
/* DATE should stay a plain YYYY-MM-DD string — turning it into a Date shifts it by
   the server's timezone offset, which silently moves due dates across midnight. */
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: config.isProd && !config.databaseUrl.includes("localhost") ? { rejectUnauthorized: false } : undefined,
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

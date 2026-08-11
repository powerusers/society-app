import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool, closePool } from "./pool.js";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "migrations");

async function ensureTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
}

async function pending(client) {
  const files = (await readdir(DIR)).filter((f) => f.endsWith(".sql")).sort();
  const { rows } = await client.query("SELECT name FROM schema_migrations");
  const done = new Set(rows.map((r) => r.name));
  return files.filter((f) => !done.has(f));
}

export async function migrate({ silent = false } = {}) {
  const client = await pool.connect();
  const log = (...a) => !silent && console.log(...a);
  try {
    await ensureTable(client);
    const todo = await pending(client);
    if (!todo.length) { log("[migrate] already up to date"); return []; }

    for (const file of todo) {
      const sql = await readFile(join(DIR, file), "utf8");
      // Each migration is one transaction: it applies completely or not at all.
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        log(`[migrate] applied ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed: ${err.message}`);
      }
    }
    return todo;
  } finally {
    client.release();
  }
}

export async function status() {
  const client = await pool.connect();
  try {
    await ensureTable(client);
    const todo = await pending(client);
    const { rows } = await client.query("SELECT name, applied_at FROM schema_migrations ORDER BY name");
    console.log("Applied:");
    for (const r of rows) console.log(`  ✓ ${r.name}  ${r.applied_at.toISOString()}`);
    console.log(todo.length ? `Pending:\n${todo.map((t) => `  · ${t}`).join("\n")}` : "Pending: none");
  } finally {
    client.release();
  }
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  const cmd = process.argv[2] || "up";
  try {
    if (cmd === "status") await status();
    else await migrate();
  } catch (err) {
    console.error(`[migrate] ${err.message}`);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

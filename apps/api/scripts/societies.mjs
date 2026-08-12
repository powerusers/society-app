/**
 * Inspect and remove societies.
 *
 * The usual reason to reach for this is a demo society left behind by
 * `npm run seed` on a database that now holds a real one.
 *
 *   npm run societies --workspace @gvs/api -- list
 *   npm run societies --workspace @gvs/api -- delete "Green Valley Society"
 *
 * Deleting is not reversible and not partial: every flat, resident, bill,
 * payment, receipt, gate movement, ticket, document row and audit entry
 * belonging to that society goes with it, because they all cascade from it.
 * So it prints what it is about to destroy and makes you type the name back.
 */
import { many, one, query, closePool, isLocalDatabase, databaseHost } from "../src/db/pool.js";
import { config } from "../src/config.js";

const argv = process.argv.slice(2);
const cmd = argv[0] || "list";

const COUNTS = [
  ["flats", "flats"],
  ["residents & staff", "users"],
  ["bills", "bills"],
  ["payments", "payments"],
  ["visitors", "visitors"],
  ["tickets", "tickets"],
  ["documents", "documents"],
  ["registrations", "registrations"],
];

async function summarise(societyId) {
  const out = {};
  for (const [label, table] of COUNTS) {
    const { count } = await one(`SELECT count(*)::int AS count FROM ${table} WHERE society_id = $1`, [societyId]);
    out[label] = count;
  }
  return out;
}

async function list() {
  const societies = await many("SELECT id, name, address, created_at FROM societies ORDER BY created_at");
  if (!societies.length) {
    console.log("No societies on this database.");
    return societies;
  }
  for (const s of societies) {
    const counts = await summarise(s.id);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(`\n  ${s.name}`);
    console.log(`    id       ${s.id}`);
    console.log(`    created  ${new Date(s.created_at).toISOString().slice(0, 10)}${s.address ? ` · ${s.address}` : ""}`);
    console.log(`    holds    ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", ")}  (${total} rows)`);
  }
  console.log("");
  return societies;
}

async function remove(target) {
  if (!target) throw new Error('Name the society: delete "Green Valley Society"');

  /* Match on id or exact name so a partial string cannot resolve to the wrong
     society — "Green" should not be enough to delete anything. */
  const matches = await many(
    "SELECT id, name FROM societies WHERE id::text = $1 OR lower(name) = lower($1)",
    [target],
  );
  if (!matches.length) {
    const all = await many("SELECT name FROM societies ORDER BY name");
    throw new Error(
      `No society matches "${target}". On this database: ${all.map((s) => `"${s.name}"`).join(", ") || "none"}`,
    );
  }
  if (matches.length > 1) throw new Error(`"${target}" matches ${matches.length} societies — use the id instead`);

  const society = matches[0];
  const counts = await summarise(society.id);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  console.log(`\n  About to delete "${society.name}" from ${databaseHost(config.databaseUrl)}`);
  console.log(`  and with it: ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", ")}`);
  console.log(`  ${total} rows in total. This cannot be undone.\n`);

  /* A typed name is the only confirmation offered. A --yes flag is too easy to
     leave in a shell history and re-run against the wrong database. */
  const confirmIndex = argv.indexOf("--confirm");
  const typed = confirmIndex === -1 ? null : argv[confirmIndex + 1];
  if (typed !== society.name) {
    console.log(`  To proceed, repeat the name exactly:\n`);
    console.log(`    npm run societies --workspace @gvs/api -- delete "${society.name}" --confirm "${society.name}"\n`);
    if (!isLocalDatabase()) {
      console.log(`  Note this is not a local database — check you meant ${databaseHost(config.databaseUrl)}.\n`);
    }
    /* Deliberately a success exit: being asked to confirm is the normal first
       half of this command, not a failure. A non-zero code here makes npm bury
       the instruction above under six lines of its own error output. */
    return;
  }

  await query("DELETE FROM societies WHERE id = $1", [society.id]);
  console.log(`  Deleted "${society.name}" and its ${total} rows.\n`);

  const left = await many("SELECT name FROM societies ORDER BY name");
  console.log(left.length
    ? `  Remaining: ${left.map((s) => s.name).join(", ")}\n`
    : "  No societies remain — the next visitor to the app will be offered setup.\n");
}

try {
  if (cmd === "list") await list();
  else if (cmd === "delete") await remove(argv[1]);
  else {
    console.log("Usage: societies list | societies delete <name-or-id> [--confirm <name>]");
    process.exitCode = 1;
  }
} catch (err) {
  console.error(`[societies] ${err.message}`);
  process.exitCode = 1;
} finally {
  await closePool();
}

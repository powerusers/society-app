import "./setup.js";
import { createApp } from "../src/app.js";
import { migrate } from "../src/db/migrate.js";
import { seed } from "../src/db/seed.js";
import { closePool, query } from "../src/db/pool.js";

/* Seeding wipes and rewrites; skipping it leaves whatever the last file left
   behind, so an unseeded run has to clear the tenant tree itself. */
const truncateAll = () => query("TRUNCATE societies CASCADE");

let server;
let base;

/**
 * @param {{seed?: boolean}} opts — pass `seed: false` for tests that need a
 * database with no society in it, which is the state first-run setup and the
 * multi-society flows are actually about.
 */
export async function startTestServer({ seed: withSeed = true } = {}) {
  await migrate({ silent: true });
  if (withSeed) await seed({ silent: true });
  else await truncateAll();
  server = createApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
  return base;
}

export async function stopTestServer() {
  await new Promise((r) => server.close(r));
  await closePool();
}

/** Thin fetch wrapper returning { status, body } so assertions stay readable. */
export async function call(method, path, { token, body, headers } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

export const get = (p, token) => call("GET", p, { token });
export const post = (p, body, token) => call("POST", p, { body, token });
export const patch = (p, body, token) => call("PATCH", p, { body, token });
export const del = (p, token) => call("DELETE", p, { token });

export async function login(email, password = "password123") {
  const { status, body } = await post("/api/auth/login", { email, password });
  if (status !== 200) throw new Error(`login failed for ${email}: ${status} ${JSON.stringify(body)}`);
  return body;
}

export const ACCOUNTS = {
  resident: "rahul@greenvalley.in",
  treasurer: "meena@greenvalley.in",
  secretary: "suresh@greenvalley.in",
  guard: "mohan@greenvalley.in",
  manager: "manager@greenvalley.in",
  plumber: "plumb@greenvalley.in",
  otherResident: "resident.c-105@greenvalley.in",
};

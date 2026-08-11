import "./setup.js";
import { createApp } from "../src/app.js";
import { migrate } from "../src/db/migrate.js";
import { seed } from "../src/db/seed.js";
import { closePool } from "../src/db/pool.js";

let server;
let base;

export async function startTestServer() {
  await migrate({ silent: true });
  await seed({ silent: true });
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
export async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
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

/**
 * Two societies on one deployment.
 *
 * The data model always carried society_id; what changed is that the entry
 * points — setup, the society list, registration and sign-in — no longer assume
 * there is exactly one. These exist to prove the boundary holds when there are
 * two, including the case that motivated it: the same flat code in both, and an
 * application reaching the right committee.
 */
import "./setup.js";
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, call, get, post } from "./helpers.js";

const TOKEN = process.env.SETUP_TOKEN;
const asSetup = (body) => call("POST", "/api/setup", { body, headers: { "x-setup-token": TOKEN } });

const setupBody = (name, email) => ({
  society: { name, address: `${name} Road, Pune`, regNo: "", gstin: "" },
  admin: { name: `${name} Admin`, email, phone: "9800000000", password: "a-properly-long-passphrase" },
});

describe("two societies on one deployment", () => {
  let alpha, beta;

  before(async () => {
    await startTestServer({ seed: false });
    const a = await asSetup(setupBody("Alpha Heights", "admin@alpha.in"));
    const b = await asSetup(setupBody("Beta Gardens", "admin@beta.in"));
    assert.equal(a.status, 201, "first society created");
    assert.equal(b.status, 201, "a second society can be created");
    alpha = { id: a.body.society.id, token: a.body.accessToken };
    beta = { id: b.body.society.id, token: b.body.accessToken };

    /* The same flat code in both — the case that breaks any code still
       resolving a society as "the only one". */
    const csv = "code,block,area\nC-1003,C,910\nC-101,C,845";
    for (const s of [alpha, beta]) {
      const r = await post("/api/flats/import", { csv, mode: "apply" }, s.token);
      assert.equal(r.status, 200);
    }
  });

  after(stopTestServer);

  test("a duplicate society name is refused", async () => {
    const r = await asSetup(setupBody("alpha heights", "someone@else.in"));
    assert.equal(r.status, 409);
    assert.match(r.body.error.message, /already exists/i);
  });

  test("setup still requires the token for every society", async () => {
    const r = await call("POST", "/api/setup", {
      body: setupBody("Gamma Court", "admin@gamma.in"), headers: { "x-setup-token": "wrong" },
    });
    assert.equal(r.status, 403);
  });

  test("the public list carries name and address, and nothing else", async () => {
    const r = await get("/api/setup/societies");
    assert.equal(r.status, 200);
    assert.equal(r.body.societies.length, 2);
    assert.deepEqual(Object.keys(r.body.societies[0]).sort(), ["address", "id", "name"]);
  });

  test("the list can be searched", async () => {
    const r = await get("/api/setup/societies?q=beta");
    assert.equal(r.body.societies.length, 1);
    assert.equal(r.body.societies[0].name, "Beta Gardens");
  });

  test("an application goes to the society the applicant chose", async () => {
    const r = await post("/api/auth/register", {
      name: "Resident One", societyId: beta.id, flatCode: "C-1003",
      relation: "owner", phone: "9811111111", email: "one@resident.in", password: "password123",
    });
    assert.equal(r.status, 201);

    const atBeta = await get("/api/registrations", beta.token);
    const atAlpha = await get("/api/registrations", alpha.token);
    assert.equal(atBeta.body.registrations.length, 1, "Beta's committee sees it");
    assert.equal(atAlpha.body.registrations.length, 0, "Alpha's committee does not");
  });

  test("one society's committee cannot approve another's application", async () => {
    const list = await get("/api/registrations", beta.token);
    const id = list.body.registrations[0].id;
    const r = await post(`/api/registrations/${id}/approve`, {}, alpha.token);
    assert.equal(r.status, 404, "not merely forbidden — not visible at all");
  });

  test("an unknown society is refused rather than defaulted", async () => {
    const r = await post("/api/auth/register", {
      name: "Nobody", societyId: "00000000-0000-0000-0000-000000000000", flatCode: "C-101",
      relation: "owner", phone: "9822222222", email: "nobody@resident.in", password: "password123",
    });
    assert.equal(r.status, 404);
  });

  test("a flat code is checked against the chosen society's register", async () => {
    const r = await post("/api/auth/register", {
      name: "Wrong Flat", societyId: alpha.id, flatCode: "Z-909",
      relation: "owner", phone: "9833333333", email: "wrong@resident.in", password: "password123",
    });
    assert.equal(r.status, 409);
    assert.match(r.body.error.message, /Alpha Heights/, "the message names the society it checked");
  });

  test("an email already used anywhere on the platform is refused", async () => {
    const r = await post("/api/auth/register", {
      name: "Clashing", societyId: alpha.id, flatCode: "C-101",
      relation: "owner", phone: "9844444444", email: "admin@beta.in", password: "password123",
    });
    assert.equal(r.status, 409);
  });

  test("the same email cannot queue at two societies at once", async () => {
    const body = (societyId) => ({
      name: "Double Applicant", societyId, flatCode: "C-101",
      relation: "owner", phone: "9855555555", email: "double@resident.in", password: "password123",
    });
    assert.equal((await post("/api/auth/register", body(alpha.id))).status, 201);
    assert.equal((await post("/api/auth/register", body(beta.id))).status, 409);
  });

  test("signing in lands in the right society", async () => {
    for (const [email, name] of [["admin@alpha.in", "Alpha Heights"], ["admin@beta.in", "Beta Gardens"]]) {
      const login = await post("/api/auth/login", { email, password: "a-properly-long-passphrase" });
      assert.equal(login.status, 200);
      const me = await get("/api/me", login.body.accessToken);
      assert.equal(me.body.society.name, name);
    }
  });

  test("a flat listed in both societies resolves to the caller's own", async () => {
    for (const [s, name] of [[alpha, "Alpha Heights"], [beta, "Beta Gardens"]]) {
      const one = await get("/api/flats/C-1003", s.token);
      assert.equal(one.status, 200);
      const all = await get("/api/flats", s.token);
      assert.equal(all.body.flats.length, 2, `${name} sees only its own two flats`);
    }
  });
});

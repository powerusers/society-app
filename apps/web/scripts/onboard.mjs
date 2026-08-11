/**
 * First-run onboarding, end to end, in a real browser against a real Postgres.
 *
 * This starts from a database with no society in it — the state a fresh
 * deployment is actually in — and drives the two flows that were previously
 * impossible without running the demo seed: creating the society, and importing
 * the flat register that decides who is allowed to register.
 *
 *   API_URL=http://127.0.0.1:4200 URL=http://127.0.0.1:4300 node apps/web/scripts/onboard.mjs
 */
import { chromium } from "playwright";

const URL = process.env.URL || "http://127.0.0.1:4300";
const API = process.env.API_URL || "http://127.0.0.1:4200";
const TOKEN = process.env.SETUP_TOKEN || "s3tup-t0ken";
const errors = [];

const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const page = await b.newPage({ viewport: { width: 430, height: 900 } });
page.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}`));
page.on("console", (m) => {
  const t = m.text();
  if (m.type() === "error" && !t.includes("Failed to load resource")) errors.push(`CONSOLE: ${t}`);
});

const wait = (ms = 400) => page.waitForTimeout(ms);
const has = async (t) => (await page.getByText(t, { exact: false }).count()) > 0;
const tap = async (t) => { await page.getByText(t, { exact: false }).first().click(); await wait(); };
const check = async (label, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"} — ${label}`);
  if (!cond) errors.push(`ASSERT: ${label}`);
};

// 1 — an unclaimed instance offers setup, not a login form
await page.goto(URL, { waitUntil: "networkidle" });
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil: "networkidle" });
await wait(900);
await check("a database with no society offers setup", await has("Set up your society"));
await check("no sign-in form is shown while unclaimed", !(await has("Quick demo access")));

// 2 — the token actually gates it
const fill = async (label, value) => {
  await page.locator(".field", { hasText: label }).first().locator("input").fill(value);
};
await fill("Society name", "Sunrise Residency");
await fill("Address", "Wakad, Pune 411057");
await fill("Registration number", "PNA/1234/2019");
await page.locator(".field", { hasText: "Full name" }).first().locator("input").fill("Nikhil Misal");
await fill("Email", "nikhil@sunrise.in");
await fill("Mobile", "9876543210");
await fill("Password", "a-properly-long-passphrase");
await fill("Token", "not-the-right-token");
await tap("Create society and sign in");
await wait(1400);
await check("a wrong setup token is refused by the server", await has("setup token is not correct"));

// 3 — with the real token the society exists and the admin is signed in
await fill("Token", TOKEN);
await tap("Create society and sign in");
await page.waitForSelector(".nav", { timeout: 15000 });
await wait(900);
await check("setup signs the new administrator straight in", await has("Nikhil"));

// 4 — the register is empty, so nobody can sign up yet
const before = await page.evaluate(async (api) => {
  const res = await fetch(`${api}/api/auth/register`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Too Early", flatCode: "B-1003", relation: "owner", phone: "9800000000", email: "early@sunrise.in", password: "password123" }),
  });
  return (await res.json())?.error?.message || "";
}, API);
await check("registration is refused before a register exists", before.includes("not on the society register"));

// 5 — import the register through the UI
await page.locator(".nav button", { hasText: "More" }).first().click();
await wait(600);
await page.locator(".li", { hasText: "Flat register" }).first().click();
await wait(700);
await check("the flat register screen is reachable for an admin", await has("Your spreadsheet"));

const CSV = [
  "Flat No.,Wing,Carpet Area,Configuration,Occupancy,Car Parking",
  'A-101,A,845,2BHK,owner,1',
  'A-102,A,"1,120",3BHK,tenant,2',
  "B-1003,B,910,2BHK,vacant,1",
  "bad-row,B,900,2BHK,owner,1",
].join("\n");
await page.locator("textarea").first().fill(CSV);
await tap("Check the file");
await wait(1200);
await check("a malformed row is reported before anything is written", await has("could not be read"));
await check("the offending line is named", await has("Line 5"));

// 6 — fix the file and import for real
await page.locator("textarea").first().fill(CSV.split("\n").slice(0, 4).join("\n"));
await tap("Check the file");
await wait(1200);
await check("a clean file previews as three new flats", await has("New flats"));
await tap("Import 3 flats");
await wait(1600);
await check("the import reports what it wrote", await has("Register imported"));

// 7 — the flat that could not register before, now can
const after = await page.evaluate(async (api) => {
  const res = await fetch(`${api}/api/auth/register`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Real Resident", flatCode: "B-1003", relation: "owner", phone: "9800000001", email: "resident@sunrise.in", password: "password123" }),
  });
  return { status: res.status, body: await res.json() };
}, API);
await check("a four-digit flat registers once it is on the register",
  after.status === 201 && after.body.status === "pending");

// 8 — re-importing the same register is a no-op, not a duplicate
await page.locator("textarea").first().fill(CSV.split("\n").slice(0, 4).join("\n"));
await tap("Check the file");
await wait(1200);
await check("re-importing the same file reports nothing to do", await has("already matches the register"));

await b.close();
if (errors.length) { console.log("\nERRORS:\n" + [...new Set(errors)].join("\n")); process.exit(1); }
console.log("\nonboarding flows passed");

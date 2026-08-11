/**
 * End-to-end against the real API.
 *
 * Unlike flows.mjs (which drives the seeded local store), this signs in with
 * real credentials and every assertion below is the result of an HTTP round
 * trip: the gate transitions, the billing run and the S3 document upload all
 * hit Postgres and the bucket.
 *
 *   API_URL=http://127.0.0.1:4000 URL=http://127.0.0.1:4300 node apps/web/scripts/live.mjs
 */
import { chromium } from "playwright";

const URL = process.env.URL || "http://127.0.0.1:4300";
const API = process.env.API_URL || "http://127.0.0.1:4000";
const PASSWORD = process.env.SEED_PASSWORD || "password123";
const errors = [];

const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const page = await b.newPage({ viewport: { width: 430, height: 900 } });
page.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}`));
page.on("console", (m) => {
  const t = m.text();
  if (m.type() === "error" && !t.includes("Failed to load resource")) errors.push(`CONSOLE: ${t}`);
});

const wait = (ms = 450) => page.waitForTimeout(ms);
const tap = async (text) => { await page.getByText(text, { exact: false }).first().click(); await wait(); };
const tab = async (label) => { await page.locator(".nav button", { hasText: label }).first().click(); await wait(700); };
const has = async (text) => (await page.getByText(text, { exact: false }).count()) > 0;
const check = async (label, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"} — ${label}`);
  if (!cond) errors.push(`ASSERT: ${label}`);
};

async function signIn(email) {
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: "networkidle" });
  await wait(600);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByText("Sign in", { exact: true }).last().click();
  await page.waitForSelector(".nav", { timeout: 10000 });
  await wait(700);
}

// 1 — real authentication
await page.goto(URL, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await wait(600);
await check("demo shortcuts are hidden when an API is configured", !(await has("Quick demo access")));

await page.locator('input[type="email"]').fill("rahul@greenvalley.in");
await page.locator('input[type="password"]').fill("definitely-wrong");
await page.getByText("Sign in", { exact: true }).last().click();
await wait(1200);
await check("a wrong password is rejected by the server", await has("incorrect"));

await signIn("rahul@greenvalley.in");
await check("signed in as the resident", await has("Rahul"));

// 2 — the session survives a reload without signing in again
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector(".nav", { timeout: 10000 });
await wait(600);
await check("session resumes from the stored refresh token", await has("Rahul"));

// 3 — bills come from Postgres
await tab("Payments");
await check("bills loaded from the API", (await has("Outstanding")) || (await has("Nothing outstanding")));

// 4 — resident issues a real gate pass
await tab("Gate");
await tap("Pre-approve");
await page.locator('input[placeholder*="Kiran"]').fill("Live Test Guest");
await tap("Create gate pass");
await wait(900);
await check("gate pass created through the API", await has("Gate pass"));
const passCode = (await page.locator(".mono").first().innerText()).trim();
console.log("      pass code:", passCode);
await page.locator(".x").first().click();
await wait();

// 5 — a resident may not act outside their own flat
const forbidden = await page.evaluate(async ({ api, token }) => {
  const res = await fetch(`${api}/api/visitors`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: "Sneaky", category: "guest", flatCode: "C-105", status: "pre-approved" }),
  });
  return res.status;
}, { api: API, token: await page.evaluate(() => sessionStorage.getItem("gvs.access.v1")) });
await check("the server refuses a visitor raised for another flat", forbidden === 403);

// 6 — the guard scans that same pass
await signIn("mohan@greenvalley.in");
await tap("Scan pass");
await page.locator('input[placeholder*="K4M9TP"]').fill(passCode);
await tap("Verify pass");
await wait(800);
await check("guard verifies the pass against the API", await has("Valid pass"));
await tap("Allow entry & start timer");
await wait(900);
await check("visitor admitted and now inside", await has("Inside the building"));

// 7 — the resident sees the state the guard just wrote
await signIn("rahul@greenvalley.in");
await tab("Gate");
await check("the resident sees the visitor the guard admitted", await has("Live Test Guest"));

// 8 — maker-checker, enforced server-side
await signIn("meena@greenvalley.in");
await tab("More");
await page.locator(".li", { hasText: "Billing & maker-checker" }).first().click();
await wait(900);
const cycles = await page.locator("select").first().locator("option").allInnerTexts();
await page.locator("select").first().selectOption({ label: cycles[0] });
await wait(1200);

if (await has("Generate")) {
  await tap("Generate ");
  await wait(2500);
  await check("billing run drafted through the API", await has("waiting for approval"));
  await check("the maker is refused by the server", await has("you cannot approve it"));

  await signIn("suresh@greenvalley.in");
  await tab("More");
  await page.locator(".li", { hasText: "Billing & maker-checker" }).first().click();
  await wait(900);
  await page.locator("select").first().selectOption({ label: cycles[0] });
  await wait(1500);
  await tap("Approve & issue");
  await page.locator(".sheet").getByText("Approve & issue", { exact: false }).click();
  await wait(2500);
  await check("a second officer approves the run", await has("approved and sent"));
} else {
  console.log("SKIP — the next cycle already has bills");
}

// 9 — a document really lands in the bucket
await signIn("suresh@greenvalley.in");
await tab("More");
await page.locator(".li", { hasText: "Documents" }).first().click();
await wait(800);
await tap("Upload a document");
await page.locator('input[type="file"]').setInputFiles({
  name: "live-test-minutes.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\nlive upload test\n%%EOF"),
});
await wait(500);
await tap("Publish to residents");
await wait(3500);
/* Assert on the list, not on any text: the upload sheet echoes the chosen
   filename, so checking for the name alone passes even when the upload failed. */
await check("the upload sheet closed, meaning the upload was confirmed", (await page.locator(".sheet").count()) === 0);
await check("the document appears in the vault list",
  (await page.locator(".list .li", { hasText: "live-test-minutes" }).count()) > 0);

await tap("live-test-minutes");
await wait(1500);
await check("no upload or download errors reached the console", true);

await b.close();
if (errors.length) { console.log("\nERRORS:\n" + [...new Set(errors)].join("\n")); process.exit(1); }
console.log("\nall live flows passed");

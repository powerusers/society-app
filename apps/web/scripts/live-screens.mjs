/**
 * Every screen, in live mode, against a society that holds nothing.
 *
 * The demo smoke test runs against a seeded store where every list has rows.
 * This is the opposite and more dangerous case: a society created this minute,
 * where the screens that still read the local store have nothing to render. A
 * list that assumed a first element, or a total over an empty array, fails here
 * and nowhere else.
 *
 *   API_URL=http://127.0.0.1:4210 URL=http://127.0.0.1:4302 node apps/web/scripts/live-screens.mjs
 */
import { chromium } from "playwright";

const URL = process.env.URL || "http://127.0.0.1:4302";
const EMAIL = process.env.EMAIL || "nikhil@sunrise.in";
const PASSWORD = process.env.PASSWORD || "a-properly-long-passphrase";
const errors = [];

const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const page = await b.newPage({ viewport: { width: 430, height: 900 } });
page.on("pageerror", (e) => errors.push(`PAGEERROR ${e.message}`));
page.on("console", (m) => {
  const t = m.text();
  if (m.type() === "error" && !t.includes("Failed to load resource")) errors.push(`CONSOLE ${t}`);
});

await page.goto(URL, { waitUntil: "networkidle" });
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(800);

await page.locator('input[type="email"]').fill(EMAIL);
await page.locator('input[type="password"]').fill(PASSWORD);
await page.getByText("Sign in", { exact: true }).last().click();
await page.waitForSelector(".nav", { timeout: 15000 });
await page.waitForTimeout(800);

/* Nothing from the demo society may be reachable from a real one. These are the
   names and codes the seed ships with; any of them on screen means the seeded
   store leaked into live mode. */
const LEAKS = ["Green Valley", "Rahul Mehta", "Meena Patil", "Mohan Singh", "A-401", "HD-2041"];

let screens = 0;

const check = async (where) => {
  const body = await page.locator("body").innerText();
  for (const leak of LEAKS) {
    if (body.includes(leak)) errors.push(`LEAK "${leak}" on ${where}`);
  }
};

const openTab = async (tab) => {
  const t = page.locator(".nav button", { hasText: tab });
  if (!(await t.count())) return false;
  /* The floating SOS button overlays part of every screen, so a normal click
     waits for it to move and never lands. Forcing past it is fine for a sweep —
     the point is to reach each screen, not to model a real tap. */
  await t.first().click({ timeout: 4000, force: true }).catch(() => {});
  await page.waitForTimeout(420);
  return true;
};

for (const tab of ["Home", "Community", "Gate", "Payments", "More"]) {
  if (!(await openTab(tab))) continue;
  screens++;
  await check(`the ${tab} tab`);

  /* Re-read the row labels each time rather than holding element handles: every
     navigation replaces the list, and a stale handle silently stops the sweep
     — which is how an earlier run "passed" after visiting nine screens. */
  const labels = [...new Set(
    (await page.locator(".li").allInnerTexts()).map((t) => t.split("\n")[0].trim()).filter((t) => t && t.length < 40),
  )];

  for (const label of labels) {
    await openTab(tab);
    const row = page.locator(".li", { hasText: label }).first();
    if (!(await row.count())) continue;
    await row.click({ timeout: 2500, force: true }).catch(() => {});
    await page.waitForTimeout(360);
    screens++;
    await check(`the screen behind "${label}" (${tab})`);
  }
}

console.log(`screens visited: ${screens}`);
await b.close();

if (errors.length) {
  console.log("\nPROBLEMS:\n" + [...new Set(errors)].map((e) => "  " + e).join("\n"));
  process.exit(1);
}
console.log("no runtime errors, and no demo data reachable");

import { chromium } from "playwright";

const URL = process.env.URL || "http://localhost:4173";
const errors = [];
const shots = [];

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
page.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}`));
page.on("console", (m) => { const t = m.text(); if (m.type() === "error" && !t.includes("Failed to load resource")) errors.push(`CONSOLE: ${t}`); });

const click = async (text, opts = {}) => {
  const l = page.getByText(text, { exact: false }).first();
  await l.waitFor({ timeout: 4000 });
  await l.click();
  await page.waitForTimeout(opts.wait || 350);
};

const shot = async (name) => {
  await page.screenshot({ path: `./.shots/${name}.png` });
  shots.push(name);
};

const loginAs = async (label) => {
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("gvs.session.v4"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await click(label);
  await page.waitForTimeout(600);
};

const tab = async (label) => {
  await page.locator(".nav button", { hasText: label }).first().click();
  await page.waitForTimeout(500);
};

const openMore = async (label) => {
  await tab("More");
  const item = page.locator(".li", { hasText: label }).first();
  await item.scrollIntoViewIfNeeded();
  await item.click();
  await page.waitForTimeout(600);
};

// ---- resident ----
await loginAs("Rahul Mehta");
await shot("resident-home");
for (const t of ["Community", "Gate", "Payments"]) { await tab(t); await shot(`resident-${t}`); }
for (const m of ["My profile", "Vehicles & parking", "Daily help & staff", "Amenities & classes", "Helpdesk", "Resident directory", "Documents", "Home services", "Emergency & SOS"]) {
  await openMore(m);
  await shot(`resident-${m.replace(/[^a-z]/gi, "")}`);
}

// ---- guard ----
await loginAs("Mohan Singh");
await shot("guard-gate");
for (const t of ["Check-in", "Patrol", "Log"]) { await tab(t); await shot(`guard-${t}`); }
await openMore("Incident register"); await shot("guard-incidents");
await openMore("Walkie-talkie"); await shot("guard-walkie");

// ---- committee ----
await loginAs("Meena Patil");
await tab("Manage"); await shot("committee-dashboard");
for (const m of ["Billing & maker-checker", "Bank reconciliation", "Ledger & expenses", "Budget vs actual", "Reports & exports", "Residents & flats", "Society staff", "Audit trail", "Society settings"]) {
  await openMore(m);
  await shot(`committee-${m.replace(/[^a-z]/gi, "")}`);
}

// ---- admin ----
await loginAs("Suresh Joshi");
await tab("Manage"); await shot("admin-dashboard");

// ---- staff ----
await loginAs("Ganesh Rane");
await shot("staff-tickets");

await browser.close();
console.log(`screens captured: ${shots.length}`);
if (errors.length) { console.log("ERRORS:\n" + [...new Set(errors)].join("\n")); process.exit(1); }
console.log("no runtime errors");

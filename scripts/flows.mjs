import { chromium } from "playwright";
const URL = process.env.URL || "http://127.0.0.1:4174";
const errors = [];
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const page = await b.newPage({ viewport: { width: 430, height: 900 } });
page.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}`));
page.on("console", (m) => { const t = m.text(); if (m.type() === "error" && !t.includes("Failed to load resource")) errors.push(`CONSOLE: ${t}`); });

const wait = (ms = 400) => page.waitForTimeout(ms);
const tap = async (text) => { await page.getByText(text, { exact: false }).first().click(); await wait(); };
const tab = async (label) => { await page.locator(".nav button", { hasText: label }).first().click(); await wait(500); };
// `fresh` wipes the seeded DB too; later logins keep it so state carries between roles.
const login = async (who, fresh = false) => {
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate((f) => (f ? localStorage.clear() : localStorage.removeItem("gvs.session.v4")), fresh);
  await page.reload({ waitUntil: "networkidle" });
  await wait(500); await tap(who); await wait(700);
};
const has = async (text) => (await page.getByText(text, { exact: false }).count()) > 0;
const check = async (label, cond) => { console.log(`${cond ? "PASS" : "FAIL"} — ${label}`); if (!cond) errors.push(`ASSERT: ${label}`); };

// 1. resident approves a gate request
await login("Rahul Mehta", true);
await check("pending visitor shown on home", await has("Ramesh Kumar"));
await tap("Approve");
await check("approval toast", await has("Approved"));

// 2. resident pre-approves a visitor and gets a QR pass
await tab("Gate");
await tap("Pre-approve");
await page.locator('input[placeholder*="Kiran"]').fill("Test Guest");
await tap("Create gate pass");
await check("gate pass QR issued", await has("Gate pass"));
const passCode = (await page.locator(".mono").first().innerText()).trim();
console.log("      pass code:", passCode);
await page.locator(".x").first().click(); await wait();

// 3. resident raises a ticket
await tab("Home");
await tap("Raise a");
await page.locator('input[placeholder*="One line"]').fill("Test complaint from smoke run");
await tap("Submit ticket");
await check("ticket created with SLA", await has("raised — SLA"));

// 4. resident pays the open bill
await tab("Payments");
await check("outstanding shown", !(await has("All clear")));
await tap("Pay now");
await page.locator(".sheet").getByText("securely", { exact: false }).click();
await wait(2200);
await check("payment succeeded", await has("Payment successful"));
await check("receipt number issued", await has("RCT-"));
await tap("Done");

// 5. guard verifies that same pass and admits the visitor
await login("Mohan Singh");
await tap("Scan pass");
await page.locator('input[placeholder*="K4M9TP"]').fill(passCode);
await tap("Verify pass");
await check("guard sees valid pass", await has("Valid pass"));
await tap("Allow entry & start timer");
await check("visitor admitted", await has("Inside the building"));

// 6. guard scans a patrol checkpoint
await tab("Patrol");
const beforeScans = Number(await page.locator(".stat .num").first().innerText());
await tap("Block A Lobby");
await tap("Log checkpoint scan");
await wait(500);
const afterScans = Number(await page.locator(".stat .num").first().innerText());
await check("patrol scan recorded", afterScans === beforeScans + 1);

// 7. committee: reconcile the bank statement
await login("Meena Patil");
await tab("More");
await page.locator(".li", { hasText: "Bank reconciliation" }).first().click(); await wait(600);
await tap("Pull today's statement");
await tap("Auto-reconcile");
await wait(600);
await check("MT940 auto-matched credits", await has("credits matched"));
await check("noise lines flagged manual", await has("could not be matched"));

// 8. committee: generate + approve next cycle billing (maker-checker)
await tab("More");
await page.locator(".li", { hasText: "Billing & maker-checker" }).first().click(); await wait(600);
const opts = await page.locator("select").first().locator("option").allInnerTexts();
await page.locator("select").first().selectOption({ label: opts[0] });
await wait(500);
const nextCycleLabel = opts[0];
if (await has("Generate")) {
  await tap("Generate ");
  await wait(600);
  await check("draft run awaiting approval", await has("waiting for approval"));
  await check("maker cannot approve own run", await has("you cannot approve it"));
} else {
  console.log("SKIP — next cycle already had bills");
}

// 9. a different officer (secretary) approves the run
await login("Suresh Joshi");
await tab("More");
await page.locator(".li", { hasText: "Billing & maker-checker" }).first().click(); await wait(600);
await page.locator("select").first().selectOption({ label: nextCycleLabel });
await wait(500);
await check("checker sees the pending run", await has("waiting for approval"));
await tap("Approve & issue");
await page.locator(".sheet").getByText("Approve & issue", { exact: false }).click();
await wait(700);
await check("run approved and issued", await has("approved and sent"));

await b.close();
if (errors.length) { console.log("\nERRORS:\n" + [...new Set(errors)].join("\n")); process.exit(1); }
console.log("\nall flows passed");

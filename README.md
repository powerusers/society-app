# Green Valley Society

A society management app covering the three areas residents and committees actually
use: **gate & security**, **community**, and **accounting (ERP)**.

The feature set is built to match what NoBrokerHood and MyGate offer — see
[PARITY.md](./PARITY.md) for a line-by-line comparison against the committee's
AGM comparison deck, including what is genuinely done and what still needs
backend or hardware work.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production bundle into dist/
npm run preview    # serve the built bundle
```

## Signing in

The login screen has one-tap demo access for each role. Every role sees a
different app — different tabs, different permissions:

| Demo user | Role | What they get |
|---|---|---|
| Rahul Mehta · A-401 | resident | Home, community, gate, payments, amenities, helpdesk |
| Meena Patil · Treasurer | committee | Everything a resident sees, plus billing, accounts, approvals |
| Suresh Joshi · Secretary | admin | Full access including society settings and the audit trail |
| Mohan Singh · Main Gate | guard | Gate console, staff check-in, patrolling, gate log, incidents |
| Ganesh Rane · Manager | staff | Ticket queue, staff register, gate view |

Data is seeded on first load (150 flats, three billing cycles, a day of gate
traffic) and persisted to `localStorage`. **More → Reset demo data** rebuilds it.

## Architecture

```
src/
  App.jsx              app shell: header, bottom tabs, screen stack, SOS overlay
  styles.js            design tokens + the whole stylesheet (class-based, no CSS-in-JS runtime)
  icons.jsx            single-stroke SVG icon set
  lib/
    format.js          currency, dates, SLA clocks, CSV export helpers
    qr.jsx             QR rendering for gate passes, staff cards, checkpoints
  store/
    index.jsx          context provider, persistence, role capability matrix, selectors
    seed.js            deterministic demo society
    actions.js         domain operations shared across screens
  components/
    ui.jsx             buttons, inputs, sheets, badges, stats, toasts
    entities.jsx       visitor / notice / ticket / bill / staff cards
    sheets.jsx         pre-approval, gate pass, raise ticket, post notice
  screens/             one file per screen, grouped by guard/ and admin/
```

Two conventions worth knowing before editing:

- **Permissions go through `can()`**, never through role string comparisons.
  The capability matrix lives at the top of `src/store/index.jsx`; adding a role
  is a one-line change there.
- **Writes go through `useActions()`** where the operation touches more than one
  collection or needs an audit entry (approving a visitor, paying a bill,
  approving a billing run). Simple single-collection edits use `add`/`patch`/
  `remove` from the store directly.

## Tests

End-to-end scripts drive a real browser. They are not wired into `package.json`
so that deploys do not pull a browser binary:

```bash
npm i -D playwright && npx playwright install chromium
npm run preview &                       # scripts default to http://127.0.0.1:4174
node scripts/smoke.mjs                  # renders all 31 screens across 5 roles, fails on any console/page error
node scripts/flows.mjs                  # drives the real workflows and asserts outcomes
```

`flows.mjs` covers the paths that span roles: a resident approves a gate request,
issues a QR pass and pays a bill; the guard scans that same pass and admits the
visitor; the treasurer imports an MT940 statement and drafts a billing run; the
secretary — not the treasurer who drafted it — approves it.

Set `CHROME_PATH` if Chromium is not where Playwright expects it, and `URL` to
point at a different server.

## Deployment

Railway via Nixpacks — `npm install && npm run build`, then `npx serve dist`.
Config lives in `nixpacks.toml` and `railway.json`.

# Green Valley Society

A society management app covering the three areas residents and committees actually
use: **gate & security**, **community**, and **accounting (ERP)**.

The feature set is built to match what NoBrokerHood and MyGate offer — see
[PARITY.md](./PARITY.md) for a line-by-line comparison against the committee's
AGM comparison deck, including what is genuinely done and what still needs
backend or hardware work.

## Layout

```
apps/
  web/        React SPA — the resident, guard and committee app
  api/        Express + Postgres API (see apps/api/README.md)
packages/
  shared/     capability matrix, bill calculation, validation schemas
```

`packages/shared` is the point of the monorepo: the authorization table, the
bill calculator and the request schemas are imported by both halves, so the
rules cannot drift apart. The web app's checks decide what to render; the API
re-checks everything for real.

## Running it

```bash
npm install
npm run dev:web    # http://localhost:3000
npm run build      # production bundle into apps/web/dist

# API — needs Postgres
cp apps/api/.env.example apps/api/.env
createdb gvs_dev && npm run migrate && npm run seed
npm run dev:api    # http://localhost:4000
```

The web app still runs entirely on its own seeded local data; it does not call
the API yet. Migrating it screen by screen is the next step.

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

## Web app architecture

```
apps/web/src/
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
  The capability matrix lives in `packages/shared/src/capabilities.js` and is
  shared with the API; adding a role is a one-line change there.
- **Writes go through `useActions()`** where the operation touches more than one
  collection or needs an audit entry (approving a visitor, paying a bill,
  approving a billing run). Simple single-collection edits use `add`/`patch`/
  `remove` from the store directly.

## Tests

`npm test` runs the shared unit tests and the API integration tests — the latter
need Postgres and a `gvs_test` database. The browser end-to-end scripts stay out
of `package.json` so deploys do not pull a browser binary:

```bash
npm test                                # shared unit tests + API integration tests

npm i -D playwright && npx playwright install chromium
npm run dev:web &                       # scripts default to http://127.0.0.1:4174
node apps/web/scripts/smoke.mjs         # renders all 31 screens across 5 roles, fails on any console/page error
node apps/web/scripts/flows.mjs         # drives the real workflows and asserts outcomes
```

`flows.mjs` covers the paths that span roles: a resident approves a gate request,
issues a QR pass and pays a bill; the guard scans that same pass and admits the
visitor; the treasurer imports an MT940 statement and drafts a billing run; the
secretary — not the treasurer who drafted it — approves it.

Set `CHROME_PATH` if Chromium is not where Playwright expects it, and `URL` to
point at a different server.

## Deployment

Two Railway services from this one repo, both building from the repo root so the
workspace resolves. Set each service's config-as-code path in the Railway
dashboard — `apps/web/railway.json` and `apps/api/railway.json` — and leave the
root directory at `/`. Link a Postgres service to the API; it injects
`DATABASE_URL`, and migrations run at boot so a deploy never serves traffic
against an older schema than the code expects.

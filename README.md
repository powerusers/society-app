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
  mobile/     React Native Android app (see apps/mobile/README.md)
  api/        Express + Postgres API (see apps/api/README.md)
packages/
  shared/     capability matrix, bill calculation, validation schemas
```

`packages/shared` is the point of the monorepo: the authorization table, the
bill calculator and the request schemas are imported by all three, so the rules
cannot drift apart. Each client's checks decide what to render; the API
re-checks everything for real.

## Running it

```bash
npm install
npm run dev:web    # http://localhost:3000
npm run build      # production bundle into apps/web/dist

# Android — needs the API running; see apps/mobile/README.md
npm run dev:mobile     # Metro
npm run android        # build and install on a device or emulator

# API — needs Postgres, and S3 for the document vault
cp apps/api/.env.example apps/api/.env
createdb gvs_dev && npm run migrate && npm run seed
npm run dev:api    # http://localhost:4000
```

Documents are stored in S3 and never pass through the API server: the browser
uploads with a presigned POST and downloads with a short-lived presigned GET.
Without `S3_BUCKET` set the API still runs — only the document endpoints return
503. See [apps/api/README.md](./apps/api/README.md) for the bucket and IAM setup.

Online payment collection is deliberately out of scope for this phase. Recording
a receipt against a bill works; a gateway is phase 2.

## Two modes

The web app runs against the API when `VITE_API_URL` is set, and falls back to
its seeded local store when it is not — so the demo build still works with no
server at all. `isLive()` in `src/lib/api.js` is the only thing that decides,
and the repository hooks in `src/data` are the only place that branches. Screens
call a hook and never learn which mode they are in.

```bash
VITE_API_URL=http://localhost:4000 npm run build   # live
npm run build                                      # demo, no server needed
```

Every repository hook in `src/data` now goes through the API: authentication and
session, the gate lifecycle, bills and payments, the billing run with
maker-checker, the helpdesk, the document vault, notices, polls, the forum,
amenities, vehicles, daily help, incidents, the directory and the flat and
resident registers.

What is still read from the local store is the handful of screens that never got
a repository hook — patrolling, the walkie-talkie, and the accounting screens
(ledger, budget vs actual, bank reconciliation and the report exports). Those are
the parts the Android app leaves on the web, since there is no endpoint behind
them to call.

## Signing in

In demo mode the login screen offers one-tap access for each role; in live mode
those shortcuts are hidden and you sign in with real credentials (the seeded
accounts are listed in [apps/api/README.md](./apps/api/README.md)). Every role
sees a different app — different tabs, different permissions:

| Demo user | Role | What they get |
|---|---|---|
| Rahul Mehta · A-401 | resident | Home, community, gate, payments, amenities, helpdesk |
| Meena Patil · Treasurer | committee | Everything a resident sees, plus billing, accounts, approvals |
| Suresh Joshi · Secretary | admin | Full access including society settings and the audit trail |
| Mohan Singh · Main Gate | guard | Gate console, staff check-in, patrolling, gate log, incidents |
| Ganesh Rane · Manager | staff | Ticket queue, staff register, gate view |

In demo mode the data is seeded on first load (150 flats, three billing cycles,
a day of gate traffic) and persisted to `localStorage`; **More → Reset demo
data** rebuilds it. In live mode it comes from Postgres.

## Web app architecture

```
apps/web/src/
  App.jsx              app shell: header, bottom tabs, screen stack, SOS overlay
  styles.js            design tokens + the whole stylesheet (class-based, no CSS-in-JS runtime)
  icons.jsx            single-stroke SVG icon set
  lib/
    api.js             fetch client, token storage, single-flight refresh, S3 upload
    query.js           useQuery / useMutation — loading, error, refetch
    format.js          currency, dates, SLA clocks, CSV export helpers
    qr.jsx             QR rendering for gate passes, staff cards, checkpoints
  data/                repository hooks — the only place that knows about live vs demo
  store/
    index.jsx          context provider, session (both modes), persistence, selectors
    seed.js            deterministic demo society
    actions.js         local-store operations, used by screens with no endpoint yet
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
- **Migrated resources go through `src/data`**, never through `api.js` or the
  local store directly. A screen calls `useVisitors()` and gets the same shape in
  both modes; adding a branch inside a screen is how the two modes start to
  drift.
- **Screens still on the local store use `useActions()`** for anything touching
  more than one collection, and `add`/`patch`/`remove` for simple edits.

## Tests

`npm test` runs the shared unit tests and the API integration tests — the latter
need Postgres and a `gvs_test` database. The browser end-to-end scripts stay out
of `package.json` so deploys do not pull a browser binary:

```bash
npm test                                # shared unit tests + API integration tests

npm i -D playwright && npx playwright install chromium
npm run dev:web &                       # scripts default to http://127.0.0.1:4174
node apps/web/scripts/smoke.mjs         # renders all 31 screens across 5 roles, fails on any console/page error
node apps/web/scripts/flows.mjs         # drives the workflows against the seeded local store

# and against the real stack: Postgres + API + S3 + a live-mode build
npm run dev:s3 & npm run dev:api &
VITE_API_URL=http://127.0.0.1:4000 npm run build && npx vite preview --port 4300 --outDir apps/web/dist &
API_URL=http://127.0.0.1:4000 URL=http://127.0.0.1:4300 node apps/web/scripts/live.mjs
```

`live.mjs` asserts nothing that is not an HTTP round trip: a wrong password
refused by the server, a session resumed from a stored refresh token, a gate
pass issued by a resident and scanned by the guard, the server refusing a
visitor raised for someone else's flat, a billing run the maker cannot approve
and a second officer can, and a document that really lands in the bucket.

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

Set `VITE_API_URL` on the **web** service to the API's public URL — it is read at
build time, so changing it needs a rebuild, and leaving it unset ships the demo
build. Set `CORS_ORIGIN` on the **api** service to the web app's origin, and add
the same origin to the S3 bucket's CORS rule.

# @gvs/api

Express + Postgres API for the society app. Authorization, billing rules and
validation come from `@gvs/shared`, which the web app imports too — so the two
halves cannot drift on who may do what or on what a bill costs.

## Running locally

```bash
cp apps/api/.env.example apps/api/.env       # then edit DATABASE_URL / JWT_SECRET
createdb gvs_dev
npm run migrate                              # applies src/db/migrations/*.sql in order
npm run seed                                 # 150 flats, 3 billing cycles, live gate traffic
npm run dev:api                              # http://localhost:4000
```

Seeded accounts all share `SEED_PASSWORD` (default `password123`):

| Email | Role |
|---|---|
| `rahul@greenvalley.in` | resident · A-401 |
| `meena@greenvalley.in` | committee · Treasurer |
| `suresh@greenvalley.in` | admin · Secretary |
| `mohan@greenvalley.in` | guard · Main Gate |
| `manager@greenvalley.in` | staff · Facility Manager |

## Tests

```bash
createdb gvs_test
npm run test --workspace @gvs/api
```

Integration tests only — they run against a real Postgres, migrate and seed it,
then drive HTTP. `test/setup.js` refuses to run unless `DATABASE_URL` names a
database ending in `_test`, because the suite truncates every table.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/auth/login` | Rate limited per IP + email |
| `POST` | `/api/auth/refresh` | Rotates; a replayed token is dead |
| `POST` | `/api/auth/register` | Creates a pending application, never an account |
| `POST` | `/api/auth/logout` | Revokes every refresh token for the user |
| `GET` | `/api/me` | User, flat, society and the caller's capability list |
| `PATCH` | `/api/me` | Name, phone, notification and privacy preferences |
| `POST` | `/api/me/password` | Revokes other sessions on success |
| `GET` | `/api/me/directory` | Numbers masked unless shared or you are committee |
| `GET` | `/api/me/audit` | Append-only trail, `reports.view` |
| `GET` | `/api/flats`, `/api/flats/:code` | Dues included for `accounts.view` |
| `GET/POST` | `/api/registrations`, `/:id/approve`, `/:id/reject` | `resident.approve` |
| `GET/POST` | `/api/visitors` | Scoped to your flat unless you hold `gate.view` |
| `PATCH` | `/api/visitors/:id/status` | The whole gate lifecycle |
| `POST` | `/api/visitors/verify-pass` | Gate device scanning a QR pass |
| `GET` | `/api/visitors/overstays` | Live overstay alarm feed |
| `GET` | `/api/bills`, `/api/bills/:id` | Drafts hidden from residents |
| `POST` | `/api/bills/runs` | Maker step, `billing.make` |
| `GET` | `/api/bills/runs/:cycle` | Reports `canApprove` and why not |
| `POST` | `/api/bills/runs/:cycle/approve` | Checker step, blocked for the maker |
| `DELETE` | `/api/bills/runs/:cycle` | Discards drafts |
| `POST` | `/api/bills/:id/pay` | Payment + ledger entry in one transaction |
| `GET/POST/PATCH` | `/api/tickets` … | SLA set from priority; staff close their own |

## Decisions worth knowing

**Authorization is re-checked here, always.** The web app's `can()` decides
which buttons to draw. This service decides what actually happens, from the same
`CAPS` table. Never treat a client check as security.

**Separation of duties is enforced twice.** `canApproveRun` rejects the maker at
the API, and a `CHECK (approved_by <> maker_id)` constraint rejects it at the
database. A test asserts the constraint fires on direct SQL, so the rule holds
even if a future endpoint forgets to ask.

**Users are re-read on every request.** Roles and suspensions take effect
immediately rather than whenever an access token happens to expire.

**Refresh tokens rotate and are stored hashed.** A leaked database does not hand
over live sessions, and a replayed token is already revoked.

**Money is `numeric(12,2)`,** parsed to a JS number by a pg type parser. Bill
totals are computed by `@gvs/shared`, never in SQL, so the preview the committee
approves and the bill the resident receives are the same function.

**Multi-tenancy is present but unused.** Every table carries `society_id` and
every query filters on the caller's. One society today; the model does not need
rewriting for the second.

## Not built yet

Payment gateway (the pay endpoint records a payment, it does not move money),
push notifications, file storage for documents, the MT940 bank feed, amenity
bookings, notices and polls, and the incident/patrol write endpoints. The gate,
helpdesk and billing paths are the ones the web app will migrate onto first.

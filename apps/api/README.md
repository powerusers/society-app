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

Point it somewhere else by overriding that variable, which is useful when 5432
is already taken:

```bash
DATABASE_URL=postgres://gvs:gvs@127.0.0.1:55433/gvs_test \
  npm run test --workspace @gvs/api
```

`test/push.test.js` is worth knowing about specifically: it asserts that a gate
request reaches only the flat it was raised against, and nobody else. See
[Who a gate request reaches](#who-a-gate-request-reaches).

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
| `GET` | `/api/documents` | Committee-only files absent from a resident's response |
| `POST` | `/api/documents/upload-url` | Presigned POST for a direct-to-S3 upload |
| `POST` | `/api/documents/:id/complete` | Confirms the object landed, records its real size |
| `GET` | `/api/documents/:id/download` | Short-lived presigned GET, forced to `attachment` |
| `DELETE` | `/api/documents/:id` | Removes the row and the object |
| `POST` | `/api/documents/sweep` | Clears abandoned uploads, admin only |
| `POST` | `/api/devices` | Registers a push token; re-points it if the phone changed hands |
| `DELETE` | `/api/devices` | Drops this device, on sign-out |

## Push notifications (FCM)

Optional. Without it the API runs exactly as before and the apps still work — a
gate request is recorded and shows up on the resident's next fetch. What is lost
is the part that matters most: the resident learning about it while the guard is
still standing at the gate with somebody in front of them.

Two transitions send, and only two. A notification for every step of the
lifecycle is how people learn to swipe them all away.

| Transition | Goes to | How it arrives |
|---|---|---|
| → `pending` (guard sends to the flat) | Everyone living in that flat, except whoever pressed the button | **Data-only**, so the app raises a ringing full-screen approval screen over the lock screen |
| → `approved` / `denied` | The guard who raised it | Ordinary notification — nobody is waiting on the guard to act |

The gate request is sent **data-only on purpose**. A message carrying a
`notification` block is drawn by the Android system before any app code runs, and
the app's background handler is never called — which would leave no chance to
attach the full-screen intent that wakes a locked phone. The cost is that a
force-stopped app receives nothing, because Android will not restart a process
the user explicitly killed; the request is still waiting when they next open the
app. See `apps/mobile/README.md` for the device half.

Setup is in `.env.example`: create a Firebase project, take a service account key
from **Project settings → Service accounts**, and supply it as
`FCM_SERVICE_ACCOUNT_JSON` (one line, suits Railway) or
`GOOGLE_APPLICATION_CREDENTIALS` (a path, suits a local checkout). The Android
app needs the matching `google-services.json` — see `apps/mobile/README.md`.

### Who a gate request reaches

A visitor at A-401 is A-401's business. The scoping is two steps, and
`test/push.test.js` covers both — it is the privacy boundary of the feature, so
it is tested rather than assumed:

1. **`usersInFlat(societyId, flatId)`** picks the people: active members of that
   one flat, in that one society. A committee member who lives in B-201 is not
   included, despite holding `gate.view` — seeing the whole gate on a screen they
   opened is not the same as being woken by every visitor in the society.
2. **`recipientTokens(userIds, pref)`** picks their devices: rows in
   `device_tokens` belonging to those users, still active, and not muted.

The guard who pressed the button is filtered out in between — they do not need
telling what they just did.

Some consequences that fall out of reading `users.flat_id` live, rather than
copying it onto the token:

- A resident who moves flats immediately starts getting the new flat's requests
  and stops getting the old one's.
- A suspended member's phone stops receiving. Their row remains; being suspended
  should not mean still being told who is at the gate.
- A whole household is notified, not just the first match — several people, and
  often several phones each. Whoever is nearest the door can answer.

**A phone that changes hands** is handled by `UNIQUE (token)` plus the upsert in
`POST /api/devices`: registering re-points the existing row at whoever is signed
in now, rather than adding a second. Sign-out deletes it outright, and that
delete is scoped to the caller — a token is a delivery address, and letting
anyone delete an arbitrary one would let them silence a neighbour's gate alerts.
The residual case is a phone given away and never signed into again, whose token
lingers until FCM reports it `UNREGISTERED` (which an uninstall triggers).

Things worth knowing before changing this:

- **Sending never fails a request.** `sendToUsers()` resolves rather than
  throws, and the call site is wrapped besides. The transition has already
  committed by then; turning a push failure into a 500 would fail the write that
  actually mattered and leave a guard retrying an approval that already
  happened.
- **It runs after the transaction, never inside it.** FCM is sometimes slow, and
  holding a row lock on the gate's busiest table while waiting on someone else's
  HTTP call is how a busy gate stops working.
- **Dead tokens are pruned as they are found.** `UNREGISTERED`,
  `INVALID_ARGUMENT` and `SENDER_ID_MISMATCH` mean the token will fail forever —
  an uninstalled app would otherwise be retried on every visitor for years.
- **`notify` preferences are honoured in the query**, not after it. Absent means
  on, so a resident who has never opened the profile screen still hears about
  somebody at their gate; only an explicit `false` excludes them.
- **The client is told whether push actually works.** `POST /api/devices`
  answers with `pushConfigured`, so the app can say "alerts only while open"
  rather than promising notifications a credential-less deployment will never
  send.

## Document storage (S3)

Bytes never pass through this server. Uploading is two calls:

1. `POST /api/documents/upload-url` — validates the name, category, content type
   and declared size, writes a `pending` row, and returns a **presigned POST**.
2. The browser posts the returned fields plus the file straight to S3.
3. `POST /api/documents/:id/complete` — the server calls `HeadObject` to confirm
   the object exists and records the size S3 actually received, not the size the
   client claimed. Only then does the document become `ready` and appear in lists.

Downloads are a presigned GET issued per request, after the authorization check,
valid for two minutes.

Things worth keeping true if you change this:

- **The object key is built server-side** from the society id and the new
  document's id: `societies/{societyId}/documents/{documentId}/{safeName}`.
  Nothing the client sends reaches the key unsanitised, so a crafted filename
  cannot escape the prefix or reach another society's files.
- **The size limit and the content type are signed policy conditions**, so S3
  itself refuses a body that violates them. Validating only in the API would
  check what the client said it was about to upload, not what it uploaded.
- **The content type is an allowlist.** HTML and SVG are excluded because they
  execute script when a browser renders them. Downloads are additionally forced
  to `Content-Disposition: attachment`, so nothing renders inline from the
  bucket's origin even if a file is mislabelled.
- **The bucket is private.** No public reads, no bucket policy for anonymous
  access. In production, attach an IAM role rather than setting keys; it needs
  only `PutObject`, `GetObject`, `DeleteObject` and `HeadObject` on
  `<bucket>/societies/*`.
- **The bucket needs a CORS rule.** Because the browser posts directly to S3,
  the preflight fails without one and every upload dies before a byte moves —
  the API looks fine and the upload silently never happens. Set:

```json
[{
  "AllowedOrigins": ["https://your-web-app.example"],
  "AllowedMethods": ["POST", "GET", "HEAD"],
  "AllowedHeaders": ["*"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3000
}]
```

`S3_ENDPOINT` and `S3_FORCE_PATH_STYLE` point the client at a local
S3-compatible server. `npm run dev:s3` starts one on port 9100 with the CORS
rule already applied, and the tests run the real presigned flow against an
in-process instance.

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

## Payments — phase 2

There is no payment gateway and none is planned for this phase. What exists is
receipt recording: `POST /api/bills/:id/pay` writes a payment, a receipt number,
a flat-wise bank narration and the matching ledger entry, in one transaction.
That is what a treasurer needs to book a cheque, a cash payment or a NEFT credit
that arrived out of band, and it is genuinely useful without a gateway.

What phase 2 adds on top: an online collection flow (gateway checkout, webhook
confirmation, idempotency keys on the webhook, refunds and chargeback handling)
and the real settlement timing. Until then `settled_at` is computed from the
society's configured window rather than reported by a processor — the column is
a projection, not a fact, and no screen should present it as confirmed.

## Not built yet

Push notifications, the MT940 bank feed, amenity bookings, notices and polls,
and the incident/patrol write endpoints. The gate, helpdesk, documents and
billing paths are the ones the web app will migrate onto first.

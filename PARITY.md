# Feature parity against the AGM comparison deck

Every row of the committee's *MyGate vs NoBrokerHood* comparison, mapped to what
this app now does.

**Legend** — ✅ built and working · 🟡 built as far as a frontend can go, the
remaining part needs a backend, hardware or a third-party contract · ⬜ not built.

---

## Gate & security

| Deck row | Status | Where it lives / what is missing |
|---|---|---|
| Biometric staff entry included at no extra cost | 🟡 | `GuardCheckin` — fingerprint/face check-in flow, per-staff enrolment toggle, attendance written on every scan. Needs a real biometric reader on the gate device. |
| 3 gate devices included from day one | ✅ | Three gates seeded (main / service / clubhouse), each with its own device ID, queue, and online status. The guard switches gates from the console. |
| Alarm when delivery boys overstay in the building | ✅ | Per-visitor in-building limit, live countdown on the resident's home screen and the guard console, alarm banner on breach, one tap to log it as an incident. Limit is configurable in society settings. |
| QR self check-in for deliveries (guardless gates) | ✅ | Residents issue a QR gate pass; the guard scans it, or the visitor self-checks in. Pass verification is a real lookup — an unknown or used code is rejected. |
| Pinless resident entry via access-control devices | 🟡 | Vehicles carry a sticker QR and are flagged for plate recognition at the main gate. The boom barrier / access-control hardware integration is not something the app can do alone. |
| Audio-enabled gate pass for house help & vendors | 🟡 | Staff carry QR cards with photo, role, flats and verification status. The recorded-audio greeting on the pass is not implemented. |
| Smartwatch entry approvals (Android & iOS) | 🟡 | Approval payloads are watch-sized and the paired watch shows in the profile, but shipping actual watch apps is separate native work. |
| Vendor entry with photo + timestamp | ✅ | Photo capture step in the guard entry flow; entry, exit and verifying guard are timestamped on every record and exportable. |

## Community & guards

| Deck row | Status | Where it lives / what is missing |
|---|---|---|
| Walkie-talkie across all gate devices (with recordings) | 🟡 | Push-to-talk console with per-device status and an archive of recorded transmissions. Real audio transport needs a media server. |
| One-click recording of misbehaviour with security | ✅ | Single button on the guard console; captures type, severity, who is involved, a recording ID and the gate device, then alerts the committee. Everything lands in the incident register. |
| Guard leaderboard & incentives | ✅ | Ranked by patrol scans, entries verified and incidents recorded — on the patrol screen for guards and under society staff for the committee. |
| Staff portal to close complaint tickets | ✅ | `staff` is a first-class role with its own login and ticket queue. Staff pick up, comment on and resolve tickets without the committee relaying messages. |
| AI voice helpdesk: tickets auto-created from calls | 🟡 | Tickets carry a source (`app` / `ai-call`) and call-sourced tickets are shown as such. The telephony and transcription pipeline is a backend service. |
| Resident-level notification controls | ✅ | Six independent switches per resident including quiet hours, stored per user. Emergency alerts deliberately ignore quiet hours. |
| In-house home services (painting, movers, repairs) | ✅ | Catalogue with rates and ratings, quote requests tracked per flat. |
| GPS guard patrolling with geo-tagged QR checkpoints | ✅ | Six checkpoints with QR codes, scans stamped with guard, time and coordinates, overdue checkpoints flagged after the round interval. |

## Accounting (ERP)

| Deck row | Status | Where it lives / what is missing |
|---|---|---|
| Instant settlement to the society account in 30 minutes | 🟡 | Every payment creates a settlement record with a live tracker to the settlement time; the window is configurable. The actual settlement speed is a payment-gateway contract, not code. |
| Flat number in the bank passbook narration | ✅ | Every receipt carries a structured narration (`UPI/CR/GVS/<flat>/<cycle>`), shown to the resident and used for matching. |
| Auto bank reconciliation (MT940) | ✅ | Real MT940 parser reading `:61:`/`:86:` pairs, matched against unreconciled receipts by flat and amount. Unmatched lines are listed for manual handling instead of being silently dropped. |
| Maker-checker approval before bills go out | ✅ | Generating a run creates drafts under the maker's name; nothing reaches residents until a *different* officer with approval rights signs off. The app blocks the maker from approving their own run. |
| Universal deposit slip for all Indian banks | ✅ | Slip details with the reference format, exportable, so cash and cheque credits reconcile the same way UPI does. |
| 350+ bill calculation combinations | ✅ | Configurable charge heads across four calculation bases (per sq ft, flat rate, per parking slot, tenanted-only), each with its own rate and GST — the combinations come from composing heads, and heads are editable in settings. |
| Tally integration, GST/TDS reports, e-invoicing | 🟡 | GST summary and Form 26Q TDS exports, plus CSV for every ledger and report, ready for Tally import. A direct Tally connector and IRP e-invoicing need server-side integrations. |
| Budgeting, variance reports & billing audit trails | ✅ | Budget vs actual per head with pro-rata variance flags, and an append-only audit trail covering approvals, rejections, billing runs and setting changes. |

## Beyond the deck

Things neither column of the comparison lists, now in the app: notice board with
reactions, comments and read receipts; society polls with live results; a
resident marketplace and discussion forum; a masked resident directory; a
document vault; amenity **and** class bookings with committee approval for
high-value slots; an SOS panic flow that broadcasts to every gate.

---

## What is genuinely not done

The web app is a complete frontend against seeded local data. A backend now
exists alongside it (`apps/api`) with real auth and server-enforced
authorization, but the two are not connected yet. To run a real society on this,
these need building:

1. **Wiring the web app to the API** — screens still read and write
   `localStorage`. The API covers auth, the gate lifecycle, billing with
   maker-checker, and the helpdesk; those screens migrate first. Notices, polls,
   amenities, documents and the incident/patrol writes have no endpoints yet.
2. **Payment gateway** — the pay endpoint records a payment, a receipt and a
   ledger entry, but calls no gateway and moves no money.
3. **Push notifications** — approvals currently surface in-app only; gate
   requests need real push to be useful.
4. **Hardware** — biometric readers, plate recognition, boom barriers and the
   gate tablets themselves.
5. **Telephony** — for the AI voice helpdesk.
6. **Bank feed** — the MT940 import parses a real statement format, but a live
   feed has to be arranged with the bank.
7. **File storage** — uploaded documents are recorded as metadata, not stored.

The commercial gap in the deck — ₹5.73 lakh over ten years — is a vendor pricing
question, not a feature question, and nothing here changes it.

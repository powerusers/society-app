# Prangan for Android

The React Native client for the same API the web app talks to. Bare React Native
CLI — no Expo.

```
apps/mobile/
  App.jsx              splash → sign-in → navigator
  src/
    theme.js           design tokens, ported from the web stylesheet
    icons.jsx          the icon set, generated from apps/web/src/icons.jsx
    config.js          which API the build talks to
    lib/
      api.js           fetch client, token storage, single-flight refresh
      query.js         useQuery / useMutation — copied from web, unchanged
      format.js        currency, dates, SLA clocks
      qr.jsx           QR rendering for gate passes and staff cards
      push.js          FCM permission, token registration, message handlers
      gate.js          the native module: ringtone, closing, Android 14 permission
      picker.js        the system file picker, for document upload
      mark.js          the Prangan mark's geometry, copied from web
    data/              repository hooks — one per resource, all live
      approvals.jsx    the gate-approval queue behind the popup
    store/index.jsx    session, society settings, capabilities
    components/        UI kit, entity cards, action sheets, screen shell
      ApprovalPrompt.jsx  the in-app "someone is at your gate" modal
      QrScanner.jsx    camera scanning for gate passes and staff cards
    navigation/        role-based tabs and the screen stack
    screens/           one file per screen, grouped by guard/ and admin/
      GateApproval.jsx the lock-screen approval — its own React root, not a route
  scripts/icons.mjs    regenerates the launcher icon from the mark
  android/app/src/main/java/com/gvs/prangan/
    GateAlert.kt              the ringing full-screen notification
    GateApprovalActivity.kt   shows over the lock screen, owns the ringtone
    GateModule.kt             what JavaScript calls back into
    PranganMessagingService.kt  receives FCM, extends the library's service
    MainApplication.kt        notification channels, foreground tracking
  android/app/src/debug/      GateTestReceiver — fires an alert from adb
```

## Running it

The app is **live-only** — there is no demo mode and no seeded local store, so it
needs the API running.

```bash
npm install                       # from the repo root

# point the app at your API — see src/config.js
npm run dev:api                   # the Express API, needs Postgres

npm start   --workspace @gvs/mobile   # Metro
npm run android --workspace @gvs/mobile
```

`src/config.js` holds `API_URL`. It defaults to `http://10.0.2.2:4000`, which is
the Android emulator's alias for the host machine's localhost — inside the
emulator, "localhost" is the emulator itself, and that is the most common reason
a dev build appears to have no server. On a physical device over Wi-Fi use the
host's LAN IP; for a release build, point it at the deployed API.

If the app cannot reach Metro, forward the ports:

```bash
adb reverse tcp:8081 tcp:8081 && adb reverse tcp:4000 tcp:4000
```

## Building a release

```bash
npm run apk    --workspace @gvs/mobile   # android/app/build/outputs/apk/release/
npm run bundle --workspace @gvs/mobile   # .aab for the Play Store
```

The arm64 release APK is about 30 MB, roughly 8 MB of which is the bundled
MLKit barcode model — see [Scanning](#scanning) for why it is bundled rather
than downloaded.

**Release builds require an https API.** React Native sets
`usesCleartextTraffic=false` for release and `true` for debug, so a release APK
pointed at an `http://` address fails every request as a network error — which
the app reports as "No connection to the society server", indistinguishable from
the server being down. That is the right default; it just means a local http mock
can only be exercised with a debug build.

Release builds are **not signed for distribution yet** — `android/app/build.gradle`
still points `signingConfigs.release` at the debug keystore, which is the
template default. Generate an upload key and point it at that before publishing;
an APK signed with the debug key cannot be uploaded to Play.

## What is shared with the web app and the API

`@gvs/shared` is imported unchanged: the capability matrix, the bill calculator,
the validation schemas and the entity enums. Screens read option lists
(`TICKET_CATEGORIES`, `VISITOR_CATEGORIES`, `PAYMENT_MODES`…) straight from it
rather than restating them, so this client cannot offer a value the API rejects.

**Permissions go through `can()`**, never through role string comparisons, and
`can()` asks the capability list the server sent with `/api/me` — the same list
that gates the requests. The capability names must exist in
`packages/shared/src/capabilities.js`: a name that is not in `CAPABILITIES` can
never be granted, so `can()` silently returns `false` and the feature disappears
for every role including admin.

## Differences from the web app, and why

| | Web | Android | Why |
|---|---|---|---|
| Data source | API **or** seeded local store | API only | No demo mode was asked for; a live-only client needs no local store, seed, or `sel` selectors |
| Token storage | `localStorage` (synchronous) | AsyncStorage, mirrored in memory | `request()` needs the refresh token synchronously to decide whether a 401 is worth retrying |
| Rupee grouping | `toLocaleString('en-IN')` | hand-rolled in `lib/format.js` | Hermes on Android ships without full ICU; a missing locale silently falls back to en-US grouping, so ₹12,34,567 would ship as ₹1,234,567 |
| Emergency contacts | a list | every number dials on tap | It is a phone |
| Pull to refresh | — | on every screen | It is the gesture people reach for |

## Monorepo notes

Three things needed configuring because npm workspaces hoists dependencies to
the repo root while the React Native tooling assumes they sit under the app:

- **`metro.config.js`** watches the repo root, searches both `node_modules`
  folders, and — the important part — redirects every `react` and `react-native`
  request to the copies under `apps/mobile`. The web app pins React 18 at the
  root and RN needs 19; without the redirect, hoisted packages like
  `@react-navigation` resolve React 18, and two Reacts means the second hook
  dispatcher is `null` (`Cannot read property 'useContext' of null`).
- **`android/settings.gradle`** resolves `@react-native/gradle-plugin` through
  Node instead of a hardcoded `../node_modules` path.
- **`android/app/build.gradle`** sets `reactNativeDir` and `codegenDir` the same
  way. Setting them on the app is enough for the whole build: ReactPlugin copies
  them onto the root extension and every autolinked library reads them back.

Native libraries are pinned to exact versions rather than carets. They ship
codegen specs that must match this React Native's codegen parser, and a caret
floats them past it — `react-native-screens@4.27` emits `React.ComponentRef<>`,
which RN 0.81's parser cannot read.

## Scanning

The guard scans a resident's gate pass (`GuardGate` → Scan pass) and a helper's
staff card (`GuardCheckin` → Scan card). Both use `components/QrScanner.jsx`.

**The typed code stays on screen underneath, always** — not hidden behind a
"having trouble?" link. A camera at a gate at night frequently will not focus, a
scratched screen protector defeats it, and a guard with somebody waiting should
never have to hunt for the way out. Both routes call the same function, so a
scanned pass and a typed one behave identically, including the failure: a pass
that does not verify reports inline rather than as a toast, because at a gate
that is a normal outcome and not an error.

A code that scans but does not verify is written into the text field, since that
is usually the wrong code rather than a misread — the guard can see it and fix it
by hand.

Implementation notes:

- **VisionCamera's code scanner is native** (MLKit), so this needs neither
  `react-native-worklets-core` nor `reanimated`. Both are optional peers and
  neither is installed; the build log confirms `Frame Processors are disabled`.
- **The MLKit model is bundled**, via `VisionCamera_enableCodeScanner=true` in
  `gradle.properties`. The alternative downloads a ~2.4 MB model on first use,
  and a gate is the worst place to discover that has failed — the camera opens
  and simply never recognises anything, with nothing on screen to explain why.
  It costs about 8 MB of APK, which is the right trade for a device whose main
  job is scanning.
- **One code, once.** MLKit reports the same symbol on every frame it can still
  see — perhaps thirty times a second. Without the guard in `QrScanner`, one pass
  would fire thirty verify calls and admit the visitor thirty times.
- **Every failure has a way forward.** No permission, permission permanently
  refused, no camera, camera crashed mid-scan — each leaves the typed field
  usable rather than presenting a dead end.
- There is a **torch toggle**, because gates are dark.

### Testing the scanner

The camera itself can be exercised on an emulator — the preview, permission
flow, torch and reticle all work against the virtual scene. Getting the emulator
to *show* a QR code is the awkward part: the virtual scene's poster surfaces
(`emulator/resources/Toren1BD.posters`) are configurable through
`virtualscene.poster.wall.filename` in the AVD's `config.ini`, but the wall sits
behind the default camera position and the scene camera follows the 6DoF
physical model, which only the emulator's own virtual-sensors panel drives —
`adb emu sensor set` does not move it.

The practical answer is a real device. Failing that, the two halves can be tested
separately: MLKit's decode is not this project's code, and everything downstream
of it is reachable through the typed-code field, which calls the same function
the scanner does.

## The document vault

Listing, downloading and uploading all work. **Bytes never pass through the API
server**: the client asks for a presigned POST, uploads straight to S3, then
tells the server the object landed. A 25 MB AGM recording therefore never
occupies a Node process.

```
POST /api/documents/upload-url   → { document, upload: { url, fields } }
POST <the bucket>                 → the file, as multipart/form-data
POST /api/documents/:id/complete  → server HEADs the object and records what really arrived
```

Downloading is the mirror image — a short-lived presigned GET handed to the
system browser, which is what can actually render a PDF and put it in Downloads.

Things worth knowing:

- **The picker runs first, the form second.** Asking somebody to fill in a name
  and category and *then* telling them their file is too big is the wrong order.
  Type and size are checked as soon as the file is chosen.
- **Those checks are duplicated on purpose.** The API re-validates both, and
  S3's presigned policy refuses an oversized body independently. Checking here
  is only so a resident on a phone hears "that is 40 MB, the limit is 25" before
  the upload rather than after it.
- **The allowlist comes from `@gvs/shared`** and is handed to the system picker,
  so unacceptable files are greyed out rather than rejected after the fact. HTML
  and SVG are deliberately absent from it — they execute script when a browser
  renders them.
- **A file with no reported size is refused.** Some providers do not give one,
  and the API wants `sizeBytes` declared up front precisely so an oversized file
  is stopped before a byte moves. Guessing would defeat that.
- **The `content://` URI is used as-is**, not copied into the app's cache first.
  Android reads it directly when building the multipart body; copying a 25 MB
  file to upload it would double the write for nothing.
- **Failing between steps 2 and 3** leaves a `pending` row with an orphaned
  object, which the API's `/sweep` endpoint clears. That is the right way round:
  the alternative is recording a document whose bytes never arrived. Pending rows
  never appear in the list — the API filters to `status = 'ready'`.
- **Progress lives in the hook, not the sheet**, so backing out of the sheet
  mid-upload does not silently cancel a transfer that is already running.

## Gate approvals and push notifications

When a guard sends a visitor up to a flat, everyone in that flat gets a
notification and — if the app is open — a modal asking them to approve or deny,
on whatever screen they happen to be on.

**The server is the source of truth and push is only a wake-up.** The prompt's
contents always come from a fetch (`src/data/approvals.jsx`); a notification just
makes it appear now rather than on the next poll. That matters because FCM
guarantees nothing about delivery, ordering or duplication — a message that is
dropped, delayed, repeated, or arrives after the visitor was already let in
cannot show the resident something untrue.

It also means **the approval prompt works with no Firebase project at all.**
Without one it polls every 20 seconds while the app is in the foreground, which
is the fallback that also covers a revoked notification permission or a phone
that silently lost its FCM token. Setting Firebase up upgrades the latency; it is
not what makes the feature work.

Other behaviour worth knowing:

- **Dismissing is per-visitor and per-session.** "Not now" (and the Android back
  button) puts that visitor aside without answering; it still shows in the Gate
  tab, and a *different* visitor raises a fresh prompt. Re-raising the same one
  twenty seconds later would make the app something people fight.
- **Tapping the notification overrides a dismissal** — that is an explicit
  "show me this one".
- **A decision taken in the prompt refreshes the rest of the app.** The provider
  bumps a revision that `useVisitors()` carries in its deps, so the Gate screen
  behind the modal does not keep saying "pending".
- **A 409 is treated as success.** It means the guard or another member of the
  flat already answered; the resident is told so and the prompt moves on.
- **The guard is notified back** when the flat approves or denies, so they are
  not left watching a screen.

### Turning push on

Without `google-services.json` the app builds and runs, and prints
`[prangan] no google-services.json — building without push notifications` during
the Gradle configure phase. To enable it:

1. Create a Firebase project, add an Android app with package name
   **`com.gvs.prangan`**, and download `google-services.json`.
2. Drop it at `apps/mobile/android/app/google-services.json`. It is gitignored —
   it identifies one Firebase project and does not belong to every fork.
3. In that same project, **Project settings → Service accounts → Generate new
   private key**, and give the JSON to the API as `FCM_SERVICE_ACCOUNT_JSON`
   (see `apps/api/.env.example`).
4. Rebuild. The configure line should now read `google-services.json found`.

Both halves are needed: the app half receives, the API half sends. With only the
app configured, devices register and nothing is ever delivered — which is why
`POST /api/devices` answers with `pushConfigured`, and the profile screen says so
rather than promising notifications that are not coming.

### The lock-screen approval screen

When a gate request arrives and the app is **not** on screen, it does not just
post a notification — it rings, wakes the phone and shows a full-screen
approve/deny screen, the way an incoming call or an authenticator prompt does.

How it fits together:

```
API  →  data-only FCM message
        └─ PranganMessagingService.onMessageReceived()      (Kotlin)
             ├─ super → React Native Firebase → JS handlers
             └─ GateAlert.showApprovalRequest()
                  └─ high-importance notification + setFullScreenIntent()
                       └─ GateApprovalActivity                (over the lock screen)
                            └─ "PranganGateApproval" JS root  (src/screens/GateApproval.jsx)
```

Four things about this are load-bearing:

- **The message is data-only.** A message carrying a `notification` block is
  drawn by the Android system before any app code runs, and the background
  handler is never called — so there would be no chance to attach a full-screen
  intent. The cost is that a *force-stopped* app receives nothing at all, because
  Android will not restart a process the user explicitly killed. That is the
  platform's rule for every app.
- **`PranganMessagingService` extends React Native Firebase's service** rather
  than `FirebaseMessagingService`, and the library's own registration is removed
  in the manifest. Android delivers a `MESSAGING_EVENT` to exactly one service;
  two registrations would have silently robbed JavaScript of every message, with
  nothing in the logs to say why.
- **A full-screen intent only auto-launches when the phone is locked or the
  screen is off.** When somebody is actively using their phone, Android shows a
  heads-up notification instead and leaves the choice to them. That is not
  something to work around — background activity launches are blocked outright
  since Android 10, and this is the sanctioned exception. The heads-up still
  rings, and tapping it opens the same screen.
- **When the app is already open, the alert is suppressed entirely** — the
  in-app modal is already asking the question, and ringing over the top of it
  would ask it twice. `MainApplication.isAppInForeground()` is what decides.

`GateApprovalActivity` is a second React root, not a route. It gets the visitor
as initial props from the notification payload, so it can draw before any network
call, and it reads the session straight off disk with `primeTokens()`. It never
touches the navigator or the session provider — it has to work when the app was
not running a second ago. It answers one question and closes, leaving whatever
was underneath untouched.

#### Android 14 and the full-screen permission

Until Android 14, declaring `USE_FULL_SCREEN_INTENT` was enough. Since 14 it is
reserved for calling and alarm apps unless the user grants it by hand, and
without it a gate request degrades to a heads-up notification — still audible,
still tappable, but it will not wake a locked phone into the approval screen.

There is no runtime prompt for this one; the only way to grant it is a Settings
page. **Profile → Notifications** checks `canUseFullScreenIntent()` and offers a
button that opens exactly that page when it is missing.

### Testing it without a Firebase project

FCM's receiver is guarded by `com.google.android.c2dm.permission.SEND`, which
only Google Play Services holds — adb cannot borrow it, and `adb root` is refused
on a Play Store system image. So `src/debug` carries a `GateTestReceiver` that
takes the same data map an FCM message carries and hands it to the same
`GateAlert` entry point. What runs is the real path: notification, full-screen
intent, activity, ringtone.

It lives in the **debug source set**, so it does not exist in a release build —
absent, not merely disabled. (Verify with
`grep GateTestReceiver app/build/intermediates/merged_manifest/release/*/AndroidManifest.xml`,
which finds nothing.)

```bash
# Lock the phone first to see the full-screen path rather than a heads-up.
adb shell input keyevent KEYCODE_SLEEP

adb shell "am broadcast -a com.gvs.prangan.TEST_GATE \
  -n com.gvs.prangan/.GateTestReceiver \
  --es type 'visitor.approval' --es visitorId '<a real pending visitor id>' \
  --es name 'Zomato Delivery' --es category 'delivery' \
  --es flatCode 'A-401' --es purpose 'Food delivery' \
  --es gateName 'Main Gate' --es phone '9800011122' --es vehicle 'MH12 QR 4455'"
```

Note the quoting: `adb shell` hands the command to the device's shell, which
re-splits it, so values containing spaces need inner quotes or they arrive
truncated.

Approve and Deny call the real API, so `visitorId` has to be a visitor that is
actually `pending` or the server will refuse the transition.

### Notification channels

Created natively in `MainApplication.kt`, not from JavaScript, so they exist
before the first message can arrive — including when a notification is what
starts the app. On Android 8+ a notification naming a channel that does not exist
is dropped with no error anywhere.

| Channel | Importance | Used for |
|---|---|---|
| `gate_v2` | High — **ringtone stream**, heads-up, bypasses DND | A visitor waiting at the gate |
| `default` | Default | Notices, bills, helpdesk updates |

The gate channel plays on the ringtone stream rather than the notification one:
the point is to be heard from a pocket while a guard waits, and a notification
chirp at notification volume is exactly what it must not be.

The id is versioned because **a channel's settings are immutable once created**.
Editing the sound or importance in `MainApplication.kt` does nothing on a device
that already has the channel — the user's copy wins, which is the whole point of
channels. Changing any of it later means a new id.

Residents can turn each off in **Profile → Notifications**; the server honours it
when selecting devices to send to, so a muted preference costs nothing to
deliver.

## Backlog

Deliberately not built, and absent rather than stubbed — a screen that opens onto
a dead end is worse than one the app never offers.

- **The accounting screens** — ledger, budget vs actual, bank reconciliation and
  report exports. Committee members use these on the web app.

  Nothing in the Android app links to them: no menu entry, no dashboard card, no
  placeholder. The committee dashboard shows what the API can answer —
  collections, the helpdesk queue, pending approvals — and stops there.

  Picking this up later means API work first. These are the only screens in the
  web app with no endpoints behind them; they read its seeded local store, so
  there is nothing for a client to call yet. `csv()` and `download()` were
  removed from `lib/format.js` at the same time, having had no other callers —
  the web app and git history both still have them.


# Prangan for Android

Native Android client — Kotlin, Jetpack Compose, Material 3 — talking to the
same `@gvs/api` the web app uses. No shared code with the web app beyond the
API contract, and no webview anywhere.

## What is here so far

- Sign-in against `/api/auth/login`, with the session surviving a relaunch.
- Automatic token renewal. The API's refresh tokens are single-use, so the
  renewal is serialised: three requests failing at once spend one refresh token
  between them, not three.
- Home: whoever is waiting at the gate, with approve and deny; who is inside;
  and the notice board.
- Capabilities come from `/api/me` rather than being inferred from the role
  string, so this app and the web app can never disagree about what a committee
  member may do.

Not yet: the remaining screens, and push notifications. Both are next.

## Building it

You need Android Studio (Ladybug or newer) or a command-line Android SDK with
platform 35 and build-tools 35. The Gradle wrapper is committed, so:

```bash
cd apps/android
./gradlew assembleDebug          # APK at app/build/outputs/apk/debug/
./gradlew installDebug           # onto a connected device or emulator
```

### Pointing it at an API

Create `apps/android/local.properties` (git-ignores it already):

```properties
# The emulator reaches the host machine at 10.0.2.2, not localhost.
API_URL_DEBUG=http://10.0.2.2:4000
API_URL_RELEASE=https://your-api.up.railway.app
```

Both have defaults if the file is absent, so a fresh clone builds. Debug builds
may use plain HTTP to a development machine; release builds may not — see
`res/xml/network_security_config.xml`. Resident phone numbers and gate approvals
do not travel over a café network in the clear.

On a **physical device** on the same wifi, use the laptop's LAN address
(`API_URL_DEBUG=http://192.168.1.x:4000`) and start the API bound to all
interfaces. The API's `CORS_ORIGIN` does not apply here — CORS is a browser
rule, and this is not a browser.

## Releasing to the Play Store

1. `./gradlew bundleRelease` produces an `.aab`.
2. It needs signing. Create an upload keystore, put its details in
   `local.properties` (never in git), and add a `signingConfigs` block.
3. A Play Console developer account is a one-time USD 25.

The application ID is `com.prangan.society`. **Fix it before the first upload** —
Play ties an app to its ID permanently, and it cannot be changed afterwards.

## What can be checked without the Android SDK

Compose needs the SDK, and `androidx` is published only to Google's Maven. But
the two pieces most likely to be silently wrong need neither, and both are
checked by running them:

```bash
apps/android/tools/contract-check.sh http://127.0.0.1:4210 someone@society.in their-password
```

**Token renewal**, against a mock server with real threads. The API's refresh
tokens are single-use, so six requests failing with 401 at the same instant must
spend one refresh between them — spend six and five are rejected against an
already-consumed token, and the resident is signed out mid-use. That is a
concurrency bug, and reading the code is not how concurrency bugs are found.
This is why `AuthInterceptor` depends on the `TokenStore` interface rather than
on DataStore directly: the inversion is what makes it runnable off a device.

**The API contract**, against a live server. Whether the JSON the API actually
sends fits the Kotlin types the app declares — a renamed field or an unexpected
null is a crash on a phone that no amount of re-reading catches.

Both pull the Kotlin compiler and dependencies from Maven Central. Nothing from
Google, so it runs anywhere a JDK does. Worth running after any change to the
API's serializers.

Everything else — the Compose screens, the theme, the DataStore-backed session —
can only be compiled where the Android SDK is.

## Shape of the code

```
core/net       Session (token storage), Network (OkHttp + Retrofit + renewal), errors
core/model     Serializable mirrors of the API's serializers
core/data      SocietyRepository — screens ask in domain terms, never in HTTP
ui/theme       The web app's palette and type scale, so the two look like one product
ui/…           Compose screens
```

Assembled by hand rather than with a dependency-injection framework: the object
graph is four deep, and Hilt would add a build step and a class of failure that
is hard to read, for nothing this app needs yet.

`AppViewModel` holds the whole app's state deliberately. The screens share
almost all of it — who is signed in, what the gate is doing, what is on the
board — and splitting it per screen would mean keeping copies in step.

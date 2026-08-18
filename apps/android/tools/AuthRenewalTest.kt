package harness

import com.prangan.society.core.net.AuthInterceptor
import com.prangan.society.core.net.RenewedTokens
import com.prangan.society.core.net.TokenStore
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/**
 * The renewal logic, run rather than reasoned about.
 *
 * The API's refresh tokens are single-use. That makes concurrency the whole
 * problem, and concurrency bugs are exactly what reading code does not catch:
 * they need a real server, real threads and real 401s.
 *
 * Not part of the app — this is the harness the Compose UI cannot have, applied
 * to the one piece of logic that most deserves it.
 */

/** A token store in memory, with the same contract as the DataStore-backed one. */
private class FakeTokens(
    var access: String? = "access-1",
    var refresh: String? = "refresh-1",
) : TokenStore {
    val saves = AtomicInteger(0)
    var cleared = false
    @Synchronized override fun accessToken() = access
    @Synchronized override fun refreshToken() = refresh
    @Synchronized override fun save(access: String, refresh: String) {
        this.access = access; this.refresh = refresh; saves.incrementAndGet()
    }
    @Synchronized override fun clear() {
        access = null; refresh = null; cleared = true
    }
}

private var failures = 0

private fun check(label: String, ok: Boolean, detail: String = "") {
    println("${if (ok) "PASS" else "FAIL"} — $label${if (detail.isNotEmpty()) " ($detail)" else ""}")
    if (!ok) failures++
}

fun main() {
    renewsOnceAndRetries()
    spendsOneRefreshForConcurrentFailures()
    signsOutWhenRefreshIsRejected()
    doesNotRenewWhenTheCallSucceeds()

    println(if (failures == 0) "\nrenewal holds under concurrency" else "\n$failures FAILURES")
    if (failures > 0) kotlin.system.exitProcess(1)
}

/** A stale token is renewed once, and the original request is retried with the new one. */
private fun renewsOnceAndRetries() {
    val server = MockWebServer()
    val seen = mutableListOf<String?>()
    server.dispatcher = object : Dispatcher() {
        override fun dispatch(request: RecordedRequest): MockResponse {
            val auth = request.getHeader("Authorization")
            synchronized(seen) { seen += auth }
            return if (auth == "Bearer access-2") MockResponse().setResponseCode(200).setBody("""{"ok":true}""")
            else MockResponse().setResponseCode(401).setBody("""{"error":{"message":"expired"}}""")
        }
    }
    server.start()

    val tokens = FakeTokens()
    val renewals = AtomicInteger(0)
    val client = OkHttpClient.Builder()
        .addInterceptor(AuthInterceptor(tokens, { old ->
            renewals.incrementAndGet()
            if (old == "refresh-1") RenewedTokens("access-2", "refresh-2") else null
        }, {}))
        .build()

    val code = client.newCall(Request.Builder().url(server.url("/api/me")).build()).execute().use { it.code }

    check("a stale token is renewed and the request retried", code == 200, "final code $code")
    check("exactly one renewal", renewals.get() == 1, "${renewals.get()}")
    check("the rotated pair is stored", tokens.access == "access-2" && tokens.refresh == "refresh-2")
    check("the retry carried the new token", seen.lastOrNull() == "Bearer access-2", seen.joinToString())
    server.shutdown()
}

/**
 * The case this lock exists for.
 *
 * Six requests fail with 401 at the same moment. Without the lock, six threads
 * each spend the single-use refresh token; five of those exchanges are rejected
 * by a real server and the person is signed out mid-use.
 */
private fun spendsOneRefreshForConcurrentFailures() {
    val server = MockWebServer()
    server.dispatcher = object : Dispatcher() {
        override fun dispatch(request: RecordedRequest): MockResponse =
            if (request.getHeader("Authorization") == "Bearer access-2")
                MockResponse().setResponseCode(200).setBody("""{"ok":true}""")
            else MockResponse().setResponseCode(401).setBody("""{"error":{"message":"expired"}}""")
    }
    server.start()

    val tokens = FakeTokens()
    val renewals = AtomicInteger(0)
    val spentTokens = mutableListOf<String>()
    val client = OkHttpClient.Builder()
        .addInterceptor(AuthInterceptor(tokens, { old ->
            renewals.incrementAndGet()
            synchronized(spentTokens) { spentTokens += old }
            /* A single-use token: the server accepts it once and never again. */
            if (old == "refresh-1") {
                Thread.sleep(60) // the exchange takes a moment, as a real one does
                RenewedTokens("access-2", "refresh-2")
            } else null
        }, {}))
        .build()

    val n = 6
    val pool = Executors.newFixedThreadPool(n)
    val start = CountDownLatch(1)
    val codes = java.util.Collections.synchronizedList(mutableListOf<Int>())
    repeat(n) {
        pool.submit {
            start.await()
            client.newCall(Request.Builder().url(server.url("/api/visitors")).build())
                .execute().use { codes += it.code }
        }
    }
    start.countDown()
    pool.shutdown()
    pool.awaitTermination(30, TimeUnit.SECONDS)

    check("every concurrent request ends up succeeding", codes.size == n && codes.all { it == 200 },
        codes.sorted().joinToString())
    check("the single-use refresh token is spent once", renewals.get() == 1, "${renewals.get()} renewals")
    check("and never spent twice", spentTokens.toSet().size == spentTokens.size, spentTokens.joinToString())
    check("nobody was signed out", !tokens.cleared)
    server.shutdown()
}

/** When the refresh token is genuinely dead, the session ends — once, and cleanly. */
private fun signsOutWhenRefreshIsRejected() {
    val server = MockWebServer()
    server.dispatcher = object : Dispatcher() {
        override fun dispatch(request: RecordedRequest) =
            MockResponse().setResponseCode(401).setBody("""{"error":{"message":"expired"}}""")
    }
    server.start()

    val tokens = FakeTokens()
    var signedOut = 0
    val client = OkHttpClient.Builder()
        .addInterceptor(AuthInterceptor(tokens, { null }, { signedOut++ }))
        .build()

    val code = client.newCall(Request.Builder().url(server.url("/api/me")).build()).execute().use { it.code }

    check("a dead session still returns the 401 rather than hanging", code == 401, "$code")
    check("stored tokens are cleared", tokens.cleared)
    check("the app is told exactly once", signedOut == 1, "$signedOut")
    server.shutdown()
}

/** The ordinary path must not touch the refresh token at all. */
private fun doesNotRenewWhenTheCallSucceeds() {
    val server = MockWebServer()
    server.enqueue(MockResponse().setResponseCode(200).setBody("""{"ok":true}"""))
    server.start()

    val tokens = FakeTokens()
    val renewals = AtomicInteger(0)
    val client = OkHttpClient.Builder()
        .addInterceptor(AuthInterceptor(tokens, { renewals.incrementAndGet(); null }, {}))
        .build()

    val code = client.newCall(Request.Builder().url(server.url("/api/notices")).build()).execute().use { it.code }
    val sent = server.takeRequest(5, TimeUnit.SECONDS)

    check("a successful call is untouched", code == 200 && renewals.get() == 0)
    check("and carries the access token", sent?.getHeader("Authorization") == "Bearer access-1",
        sent?.getHeader("Authorization") ?: "none")
    check("no needless writes to storage", tokens.saves.get() == 0, "${tokens.saves.get()}")
    server.shutdown()
}

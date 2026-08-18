package harness

import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import com.prangan.society.core.model.LoginRequest
import com.prangan.society.core.net.Api
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit

/**
 * Runs the Android app's API interface and models against the real server.
 *
 * The Android UI cannot be compiled in this environment, but the layer most
 * likely to be silently wrong can: whether the JSON the API actually sends
 * fits the Kotlin types the app declares. A misspelt field or a nullable the
 * client did not expect is a crash on a resident's phone that no amount of
 * reading catches.
 *
 * This is not part of the app. It exists so the contract is checked by running
 * it rather than by eye.
 */
fun main(args: Array<String>) = runBlocking {
    val base = args.getOrElse(0) { "http://127.0.0.1:4210" }
    val email = args.getOrElse(1) { "priya@sunrise.in" }
    val password = args.getOrElse(2) { "priya-lives-here-2026" }

    val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }
    var token: String? = null

    val client = OkHttpClient.Builder()
        .addInterceptor(Interceptor { chain ->
            val req = token?.let {
                chain.request().newBuilder().header("Authorization", "Bearer $it").build()
            } ?: chain.request()
            chain.proceed(req)
        })
        .build()

    val api = Retrofit.Builder()
        .baseUrl("$base/")
        .client(client)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()
        .create(Api::class.java)

    var failures = 0
    fun check(label: String, ok: Boolean, detail: String = "") {
        println("${if (ok) "PASS" else "FAIL"} — $label${if (detail.isNotEmpty()) " ($detail)" else ""}")
        if (!ok) failures++
    }

    // Sign in: the response has to fit SessionResponse, including the nested user.
    val session = try {
        api.login(LoginRequest(email, password))
    } catch (e: java.io.IOException) {
        /* Much the commonest way to run this wrong is against an API that is not
           up. A stack trace buries that; say it instead. */
        println("Could not reach the API at $base — is it running?")
        println("  ${e.message}")
        kotlin.system.exitProcess(2)
    } catch (e: retrofit2.HttpException) {
        println("The API refused the sign-in for $email (HTTP ${e.code()}).")
        println("  Pass a working email and password: contract-check.sh <url> <email> <password>")
        kotlin.system.exitProcess(2)
    }
    token = session.accessToken
    check("login deserialises into SessionResponse", session.accessToken.isNotBlank())
    check("and carries a user with a role", session.user.role.isNotBlank(), session.user.role)
    check("refresh token present", session.refreshToken.isNotBlank())

    // /api/me: the shape the app builds its whole permission model from.
    val me = api.me()
    check("me() gives the same person", me.user.id == session.user.id, me.user.name)
    check("society name arrives", !me.society?.name.isNullOrBlank(), me.society?.name ?: "none")
    check(
        "capabilities arrive as a list of strings",
        me.capabilities.isNotEmpty() || me.user.role == "resident",
        "${me.capabilities.size} for ${me.user.role}",
    )
    if (me.user.flat != null) {
        check("flat object matches the flat on the user", me.flat?.code == me.user.flat, me.flat?.code ?: "null")
    }

    // The two lists the home screen renders.
    val visitors = api.visitors().visitors
    check("visitors list deserialises", true, "${visitors.size} rows")
    visitors.firstOrNull()?.let { v ->
        check("a visitor has the fields the card reads", v.name.isNotBlank() && v.status.isNotBlank(),
            "${v.name} · ${v.status}")
    }

    val notices = api.notices().notices
    check("notices list deserialises", true, "${notices.size} rows")
    notices.firstOrNull()?.let { n ->
        check("a notice has title, author and a read flag", n.title.isNotBlank(),
            "${n.title} · by ${n.author} · read=${n.read} · readCount=${n.readCount}")
        check("comments and reactions parse", true,
            "${n.comments.size} comments, ${n.reactions.size} reaction kinds, mine=${n.myReactions}")
    }

    // Refresh: single-use rotation is the thing the interceptor depends on.
    val renewed = api.refresh(com.prangan.society.core.model.RefreshRequest(session.refreshToken))
    check("refresh returns a new pair", renewed.accessToken.isNotBlank() && renewed.refreshToken.isNotBlank())
    check("and rotates the refresh token", renewed.refreshToken != session.refreshToken)

    println(if (failures == 0) "\ncontract holds: the API's JSON fits the Android models"
            else "\n$failures MISMATCHES")
    if (failures > 0) kotlin.system.exitProcess(1)
}

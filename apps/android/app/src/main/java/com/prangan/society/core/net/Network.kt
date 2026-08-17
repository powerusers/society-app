package com.prangan.society.core.net

import android.content.Context
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import com.prangan.society.BuildConfig
import com.prangan.society.core.model.RefreshRequest
import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit

/**
 * Attaches the access token, and renews it once when the server says it is
 * stale.
 *
 * The refresh is serialised on this object's lock: a screen that fires three
 * requests at once and gets three 401s must not spend the single-use refresh
 * token three times, or two of those exchanges fail and the person is signed
 * out for no reason they can see.
 */
private class AuthInterceptor(
    private val session: Session,
    private val refresh: (String) -> Pair<String, String>?,
    private val onSignedOut: () -> Unit,
) : Interceptor {

    private val lock = Any()

    override fun intercept(chain: Interceptor.Chain): Response {
        val token = session.accessTokenBlocking()
        val response = chain.proceed(chain.request().withToken(token))
        if (response.code != 401) return response

        val stale = token
        response.close()

        val fresh = synchronized(lock) {
            /* Another thread may have renewed while this one waited; if the
               token has already moved on, use it rather than spending the
               refresh token again. */
            val current = session.accessTokenBlocking()
            if (current != null && current != stale) {
                current
            } else {
                val refreshToken = session.refreshTokenBlocking()
                if (refreshToken == null) {
                    onSignedOut()
                    null
                } else {
                    val renewed = refresh(refreshToken)
                    if (renewed == null) {
                        session.clearBlocking()
                        onSignedOut()
                        null
                    } else {
                        session.saveBlocking(renewed.first, renewed.second)
                        renewed.first
                    }
                }
            }
        } ?: return chain.proceed(chain.request().withToken(null))

        return chain.proceed(chain.request().withToken(fresh))
    }

    private fun Request.withToken(token: String?): Request =
        if (token == null) this
        else newBuilder().header("Authorization", "Bearer $token").build()
}

/**
 * One place that knows how to reach the society.
 *
 * Assembled by hand rather than through a dependency-injection framework: the
 * graph is four objects deep, and a framework here would cost a build step and
 * a class of failure that is hard to read, for nothing this app needs.
 */
class Network(context: Context, val session: Session) {

    private val json = Json {
        ignoreUnknownKeys = true // the API grows fields; an old build should not break on them
        coerceInputValues = true
    }

    private var signedOutListener: () -> Unit = {}

    fun onSignedOut(listener: () -> Unit) {
        signedOutListener = listener
    }

    /* A second, token-free client for the refresh call itself. Using the
       authenticated one would recurse: refresh fails, which triggers a refresh. */
    private val plain: Retrofit = Retrofit.Builder()
        .baseUrl(BuildConfig.API_URL.ensureTrailingSlash())
        .client(
            OkHttpClient.Builder()
                .connectTimeout(20, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .build()
        )
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()

    private val refreshApi: Api = plain.create(Api::class.java)

    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .addInterceptor(
            AuthInterceptor(
                session = session,
                refresh = { token ->
                    runCatching {
                        kotlinx.coroutines.runBlocking { refreshApi.refresh(RefreshRequest(token)) }
                    }.getOrNull()?.let { it.accessToken to it.refreshToken }
                },
                onSignedOut = { signedOutListener() },
            )
        )
        .apply {
            if (BuildConfig.DEBUG) {
                addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC })
            }
        }
        .build()

    val api: Api = Retrofit.Builder()
        .baseUrl(BuildConfig.API_URL.ensureTrailingSlash())
        .client(client)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()
        .create(Api::class.java)

    /** Retrofit insists; a base URL without it silently loses the last path segment. */
    private fun String.ensureTrailingSlash() = if (endsWith("/")) this else "$this/"
}

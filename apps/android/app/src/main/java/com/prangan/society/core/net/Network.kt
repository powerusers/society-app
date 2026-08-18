package com.prangan.society.core.net

import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import com.prangan.society.BuildConfig
import com.prangan.society.core.model.RefreshRequest
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit

/**
 * One place that knows how to reach the society.
 *
 * Assembled by hand rather than through a dependency-injection framework: the
 * object graph is four deep, and a framework here would cost a build step and a
 * class of failure that is hard to read, for nothing this app needs.
 */
class Network(val session: Session) {

    private val json = Json {
        ignoreUnknownKeys = true // the API grows fields; an old build should not break on them
        coerceInputValues = true
    }

    private var signedOutListener: () -> Unit = {}

    fun onSignedOut(listener: () -> Unit) {
        signedOutListener = listener
    }

    /* A second, token-free client for the renewal call itself. Using the
       authenticated one would recurse: the refresh fails, which triggers a
       refresh. */
    private val refreshApi: Api = Retrofit.Builder()
        .baseUrl(BuildConfig.API_URL.ensureTrailingSlash())
        .client(
            OkHttpClient.Builder()
                .connectTimeout(20, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .build()
        )
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()
        .create(Api::class.java)

    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .addInterceptor(
            AuthInterceptor(
                tokens = session,
                renew = { token ->
                    runCatching { runBlocking { refreshApi.refresh(RefreshRequest(token)) } }
                        .getOrNull()
                        ?.let { RenewedTokens(it.accessToken, it.refreshToken) }
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

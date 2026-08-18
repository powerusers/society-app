package com.prangan.society.core.net

import okhttp3.Interceptor
import okhttp3.Request
import okhttp3.Response

/**
 * Attaches the access token, and renews it once when the server says it is stale.
 *
 * The API rotates refresh tokens: spending one invalidates it and returns a new
 * pair. That makes concurrency the whole problem. A screen that fires three
 * requests at once and gets three 401s must spend *one* refresh between them —
 * spend three and two of those exchanges fail against an already-consumed
 * token, and the resident is signed out for a reason they cannot see.
 *
 * So renewal happens under a lock, and a thread that waited for the lock checks
 * whether somebody else already renewed before spending anything itself.
 *
 * Plain Kotlin and OkHttp on purpose — no Android — so this can be run against
 * a real server rather than reasoned about.
 */
class AuthInterceptor(
    private val tokens: TokenStore,
    /** Exchanges a refresh token for a new pair, or null if the server refused. */
    private val renew: (String) -> RenewedTokens?,
    private val onSignedOut: () -> Unit,
) : Interceptor {

    private val lock = Any()

    override fun intercept(chain: Interceptor.Chain): Response {
        val stale = tokens.accessToken()
        val response = chain.proceed(chain.request().withToken(stale))
        if (response.code != 401) return response

        /* The body has to go before the request is repeated, or the connection
           is held and the pool starves under exactly the concurrent load this
           code exists to handle. */
        response.close()

        val fresh = synchronized(lock) { renewOnce(stale) }
            ?: return chain.proceed(chain.request().withToken(null))

        return chain.proceed(chain.request().withToken(fresh))
    }

    /** Caller holds the lock. Returns the token to retry with, or null to give up. */
    private fun renewOnce(stale: String?): String? {
        /* Somebody else may have renewed while this thread waited. If the stored
           token has moved on, that renewal is ours to use. */
        val current = tokens.accessToken()
        if (current != null && current != stale) return current

        val refresh = tokens.refreshToken() ?: run {
            onSignedOut()
            return null
        }

        val renewed = renew(refresh) ?: run {
            /* The refresh token is spent or rejected. Nothing stored is worth
               keeping, and the session is genuinely over. */
            tokens.clear()
            onSignedOut()
            return null
        }

        tokens.save(renewed.access, renewed.refresh)
        return renewed.access
    }

    private fun Request.withToken(token: String?): Request =
        if (token == null) this
        else newBuilder().header("Authorization", "Bearer $token").build()
}

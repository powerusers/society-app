package com.prangan.society.core.net

/**
 * Where tokens come from, as far as the renewal logic is concerned.
 *
 * Deliberately free of Android. The renewal below is the subtlest code in this
 * app — a single-use refresh token, spent under a lock, by requests that fail
 * concurrently — and tying it to DataStore would mean it could only ever be
 * exercised on a device. Behind this interface it can be run, and is: see
 * tools/AuthRenewalTest.kt.
 */
interface TokenStore {
    fun accessToken(): String?
    fun refreshToken(): String?
    fun save(access: String, refresh: String)
    fun clear()
}

/** What the server gave back for a spent refresh token. */
data class RenewedTokens(val access: String, val refresh: String)

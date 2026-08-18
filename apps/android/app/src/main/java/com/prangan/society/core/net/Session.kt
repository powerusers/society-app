package com.prangan.society.core.net

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.runBlocking

private val Context.sessionStore by preferencesDataStore(name = "prangan_session")

/**
 * Where the tokens live between launches.
 *
 * The access token is short-lived and the refresh token is single-use — the API
 * rotates it on every renewal — so what is kept here is worth no more than one
 * exchange. That is deliberate: an app that stored a long-lived credential on
 * the device would be handing over the account with the handset.
 *
 * DataStore rather than EncryptedSharedPreferences: on a device with a lock
 * screen the app's own storage is already encrypted at rest, and the deprecated
 * crypto library buys little for a dependency that has to keep working.
 *
 * The blocking half of `TokenStore` is what OkHttp's interceptors need — they
 * are synchronous and never run on the main thread, so blocking there is
 * correct rather than merely convenient.
 */
class Session(private val context: Context) : TokenStore {

    private object Keys {
        val ACCESS = stringPreferencesKey("access_token")
        val REFRESH = stringPreferencesKey("refresh_token")
    }

    val signedIn: Flow<Boolean> = context.sessionStore.data.map { it[Keys.REFRESH] != null }

    suspend fun accessTokenAsync(): String? = context.sessionStore.data.first()[Keys.ACCESS]

    suspend fun refreshTokenAsync(): String? = context.sessionStore.data.first()[Keys.REFRESH]

    suspend fun saveAsync(access: String, refresh: String) {
        context.sessionStore.edit {
            it[Keys.ACCESS] = access
            it[Keys.REFRESH] = refresh
        }
    }

    suspend fun clearAsync() {
        context.sessionStore.edit { it.clear() }
    }

    override fun accessToken(): String? = runBlocking { accessTokenAsync() }

    override fun refreshToken(): String? = runBlocking { refreshTokenAsync() }

    override fun save(access: String, refresh: String) = runBlocking { saveAsync(access, refresh) }

    override fun clear() = runBlocking { clearAsync() }
}

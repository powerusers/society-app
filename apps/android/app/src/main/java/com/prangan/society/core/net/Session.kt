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
 * rotates it on every refresh — so what is kept here is worth no more than one
 * exchange. That is deliberate: an app that stored a long-lived credential on
 * the device would be handing over the account with the handset.
 *
 * DataStore, not EncryptedSharedPreferences: on a device with a lock screen the
 * app's own storage is already encrypted at rest, and the deprecated crypto
 * library buys little at the cost of a dependency that has to keep working.
 */
class Session(private val context: Context) {

    private object Keys {
        val ACCESS = stringPreferencesKey("access_token")
        val REFRESH = stringPreferencesKey("refresh_token")
    }

    val signedIn: Flow<Boolean> = context.sessionStore.data.map { it[Keys.REFRESH] != null }

    suspend fun save(access: String, refresh: String) {
        context.sessionStore.edit {
            it[Keys.ACCESS] = access
            it[Keys.REFRESH] = refresh
        }
    }

    suspend fun clear() {
        context.sessionStore.edit { it.clear() }
    }

    suspend fun accessToken(): String? = context.sessionStore.data.first()[Keys.ACCESS]

    suspend fun refreshToken(): String? = context.sessionStore.data.first()[Keys.REFRESH]

    /*
     * OkHttp interceptors are synchronous, and they run on a background thread
     * that is never the main thread, so blocking here is correct rather than
     * merely convenient.
     */
    fun accessTokenBlocking(): String? = runBlocking { accessToken() }

    fun refreshTokenBlocking(): String? = runBlocking { refreshToken() }

    fun saveBlocking(access: String, refresh: String) = runBlocking { save(access, refresh) }

    fun clearBlocking() = runBlocking { clear() }
}

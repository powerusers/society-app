package com.prangan.society.core.data

import com.prangan.society.core.model.LoginRequest
import com.prangan.society.core.model.MeResponse
import com.prangan.society.core.model.Notice
import com.prangan.society.core.model.RefreshRequest
import com.prangan.society.core.model.TransitionRequest
import com.prangan.society.core.model.User
import com.prangan.society.core.model.Visitor
import com.prangan.society.core.net.Network
import com.prangan.society.core.net.apiCall

/**
 * The same shape as the web app's repository layer: screens ask for things in
 * domain terms and never see a Retrofit call. It is what let the web screens
 * survive the move from browser storage to a server, and the same will be true
 * here when this app grows an offline cache.
 */
class SocietyRepository(private val network: Network) {

    private val api get() = network.api

    /* ---------------- session ---------------- */

    suspend fun signIn(email: String, password: String): Result<User> =
        apiCall { api.login(LoginRequest(email.trim(), password)) }
            .onSuccess { network.session.save(it.accessToken, it.refreshToken) }
            .map { it.user }

    /**
     * Signing out tells the server too, so the refresh token dies with the
     * session rather than staying valid on a handset that was sold.
     */
    suspend fun signOut() {
        network.session.refreshToken()?.let { token ->
            apiCall { api.logout(RefreshRequest(token)) }
        }
        network.session.clear()
    }

    suspend fun me(): Result<MeResponse> = apiCall { api.me() }

    /* ---------------- the gate ---------------- */

    suspend fun visitors(): Result<List<Visitor>> = apiCall { api.visitors().visitors }

    /**
     * Approving or denying someone at the gate.
     *
     * The server decides whether this caller may: a guard holds `gate.operate`
     * but cannot approve on a household's behalf, which is the whole point of
     * the request going to the flat. Refusals arrive as a message worth showing.
     */
    suspend fun transitionVisitor(
        visitor: Visitor,
        status: String,
        reason: String? = null,
    ): Result<Visitor> =
        apiCall { api.transitionVisitor(visitor.id, TransitionRequest(status, reason)).visitor }

    /* ---------------- the board ---------------- */

    suspend fun notices(): Result<List<Notice>> = apiCall { api.notices().notices }

    /**
     * Opening a notice marks it read. Fire and forget on purpose — a failed read
     * marker is not worth interrupting somebody in the middle of reading.
     */
    suspend fun markRead(notice: Notice) {
        if (!notice.read) apiCall { api.markNoticeRead(notice.id) }
    }
}

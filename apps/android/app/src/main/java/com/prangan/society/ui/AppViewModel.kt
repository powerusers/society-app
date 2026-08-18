package com.prangan.society.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.prangan.society.core.data.SocietyRepository
import com.prangan.society.core.model.Notice
import com.prangan.society.core.model.User
import com.prangan.society.core.model.Visitor
import com.prangan.society.core.net.Session
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * What the app is showing, and how it changes.
 *
 * One view model for the whole app rather than one per screen: at this size the
 * screens share almost all of their state — who is signed in, what the gate is
 * doing, what is on the board — and splitting it would mean synchronising the
 * copies.
 */
data class AppState(
    val loading: Boolean = true,
    val signedIn: Boolean = false,
    val user: User? = null,
    val societyName: String = "",
    val capabilities: Set<String> = emptySet(),
    val visitors: List<Visitor> = emptyList(),
    val notices: List<Notice> = emptyList(),
    val refreshing: Boolean = false,
    val busyVisitorId: String? = null,
    val signInError: String? = null,
    val signingIn: Boolean = false,
    /** Something to say once and then forget — a refusal, a confirmation. */
    val message: String? = null,
) {
    /** Visitors this person is being asked to decide about. */
    val pending: List<Visitor> get() = visitors.filter { it.status == "pending" }
    val inside: List<Visitor> get() = visitors.filter { it.status == "inside" }

    fun can(capability: String) = capability in capabilities
}

class AppViewModel(
    private val repo: SocietyRepository,
    private val session: Session,
) : ViewModel() {

    private val _state = MutableStateFlow(AppState())
    val state: StateFlow<AppState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            /* A stored refresh token is a claim, not proof. The only way to know
               whether the session survived is to ask the server. */
            if (session.refreshTokenAsync() == null) {
                _state.update { it.copy(loading = false, signedIn = false) }
            } else {
                loadSession()
            }
        }
    }

    /** Called when the interceptor gives up renewing — the session is gone. */
    fun onSignedOut() {
        _state.value = AppState(loading = false, signedIn = false)
    }

    fun signIn(email: String, password: String) {
        if (_state.value.signingIn) return
        _state.update { it.copy(signingIn = true, signInError = null) }
        viewModelScope.launch {
            repo.signIn(email, password)
                .onSuccess {
                    _state.update { s -> s.copy(signingIn = false) }
                    loadSession()
                }
                .onFailure { e ->
                    _state.update { s -> s.copy(signingIn = false, signInError = e.message) }
                }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            repo.signOut()
            _state.value = AppState(loading = false, signedIn = false)
        }
    }

    private suspend fun loadSession() {
        _state.update { it.copy(loading = true) }
        repo.me()
            .onSuccess { me ->
                _state.update {
                    it.copy(
                        loading = false,
                        signedIn = true,
                        user = me.user,
                        societyName = me.society?.name ?: "",
                        capabilities = me.capabilities.toSet(),
                    )
                }
                refresh()
            }
            .onFailure {
                /* Whatever was stored is no longer a session. Say so by showing
                   the sign-in screen rather than an empty app that keeps
                   failing. */
                session.clearAsync()
                _state.value = AppState(loading = false, signedIn = false)
            }
    }

    fun refresh() {
        if (_state.value.refreshing) return
        _state.update { it.copy(refreshing = true) }
        viewModelScope.launch {
            val visitors = repo.visitors()
            val notices = repo.notices()
            _state.update {
                it.copy(
                    refreshing = false,
                    visitors = visitors.getOrElse { _ -> it.visitors },
                    notices = notices.getOrElse { _ -> it.notices },
                    message = listOfNotNull(visitors.exceptionOrNull(), notices.exceptionOrNull())
                        .firstOrNull()?.message ?: it.message,
                )
            }
        }
    }

    /**
     * Approving or denying somebody at the gate.
     *
     * The row is replaced with what the server returned rather than with what
     * was asked for: if the guard marked them in while this was in flight, the
     * screen should show what actually happened.
     */
    fun decideVisitor(visitor: Visitor, approve: Boolean) {
        if (_state.value.busyVisitorId != null) return
        _state.update { it.copy(busyVisitorId = visitor.id) }
        viewModelScope.launch {
            repo.transitionVisitor(visitor, if (approve) "approved" else "denied")
                .onSuccess { updated ->
                    _state.update { s ->
                        s.copy(
                            busyVisitorId = null,
                            visitors = s.visitors.map { if (it.id == updated.id) updated else it },
                            message = if (approve) "${updated.name} may come up" else "Entry denied",
                        )
                    }
                }
                .onFailure { e ->
                    _state.update { it.copy(busyVisitorId = null, message = e.message) }
                    refresh()
                }
        }
    }

    fun openNotice(notice: Notice) {
        viewModelScope.launch {
            repo.markRead(notice)
            _state.update { s ->
                s.copy(notices = s.notices.map { if (it.id == notice.id) it.copy(read = true) else it })
            }
        }
    }

    fun messageShown() {
        _state.update { it.copy(message = null) }
    }

    class Factory(
        private val repo: SocietyRepository,
        private val session: Session,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T = AppViewModel(repo, session) as T
    }
}

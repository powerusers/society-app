package com.prangan.society

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import com.prangan.society.core.data.SocietyRepository
import com.prangan.society.core.net.Network
import com.prangan.society.core.net.Session
import com.prangan.society.ui.AppViewModel
import com.prangan.society.ui.home.HomeScreen
import com.prangan.society.ui.login.LoginScreen
import com.prangan.society.ui.theme.PranganTheme

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val session = Session(applicationContext)
        val network = Network(applicationContext, session)
        val repo = SocietyRepository(network)

        setContent {
            PranganTheme {
                val vm: AppViewModel = viewModel(factory = AppViewModel.Factory(repo, session))
                /* The interceptor runs on OkHttp's threads and has no view of
                   the UI; this is how "your session ended" reaches the screen. */
                remember(network, vm) { network.onSignedOut { vm.onSignedOut() }; true }
                PranganApp(vm)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PranganApp(vm: AppViewModel) {
    val state by vm.state.collectAsState()
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(state.message) {
        state.message?.let {
            snackbar.showSnackbar(it)
            vm.messageShown()
        }
    }

    when {
        state.loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }

        !state.signedIn -> LoginScreen(
            busy = state.signingIn,
            error = state.signInError,
            onSignIn = vm::signIn,
        )

        else -> Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text(state.societyName.ifBlank { "Prangan" }) },
                    actions = {
                        IconButton(onClick = vm::refresh, enabled = !state.refreshing) {
                            Icon(Icons.Filled.Refresh, contentDescription = "Refresh")
                        }
                        TextButton(onClick = vm::signOut) { Text("Sign out") }
                    },
                )
            },
            snackbarHost = { SnackbarHost(snackbar) },
            containerColor = MaterialTheme.colorScheme.background,
        ) { padding ->
            val user = state.user
            if (user == null) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            } else {
                HomeScreen(
                    user = user,
                    societyName = state.societyName,
                    pending = state.pending,
                    inside = state.inside,
                    notices = state.notices,
                    busyVisitorId = state.busyVisitorId,
                    onApprove = { vm.decideVisitor(it, approve = true) },
                    onDeny = { vm.decideVisitor(it, approve = false) },
                    onOpenNotice = vm::openNotice,
                    modifier = Modifier.padding(padding),
                )
            }
        }
    }
}

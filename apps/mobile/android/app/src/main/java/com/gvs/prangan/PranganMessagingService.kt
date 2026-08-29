package com.gvs.prangan

import com.google.firebase.messaging.RemoteMessage
import io.invertase.firebase.messaging.ReactNativeFirebaseMessagingService

/**
 * Receives push messages.
 *
 * **Extends React Native Firebase's service rather than FirebaseMessagingService
 * directly.** Android delivers a MESSAGING_EVENT to exactly one service, so
 * declaring a second one alongside the library's would silently rob JavaScript
 * of every message — `onMessage` and the background handler would simply stop
 * firing, with nothing in the logs to say why. Extending it and calling `super`
 * keeps that path intact and adds the native one on top; the library's own
 * registration is removed in AndroidManifest.xml so only this remains.
 *
 * The native part exists because a gate request has to raise a full-screen
 * approval screen while the app is not running, and JavaScript cannot: a message
 * carrying a `notification` block is drawn by the system before any app code
 * runs. So the API sends gate requests as data-only, which always arrive here.
 *
 * The cost of data-only is that a force-stopped app receives nothing, because
 * Android will not restart a process the user explicitly killed. That is the
 * platform's rule for every app, and the request is still waiting when they next
 * open Prangan.
 */
class PranganMessagingService : ReactNativeFirebaseMessagingService() {

  override fun onMessageReceived(message: RemoteMessage) {
    /* JavaScript first: the in-app prompt refreshes off this when the app is
       open, and the library's handler is what feeds it. */
    super.onMessageReceived(message)

    val data = message.data
    when (data["type"]) {
      /* The only one that rings. Everything else is an ordinary notification. */
      "visitor.approval" -> GateAlert.showApprovalRequest(applicationContext, data)

      /* The flat answered while the guard was looking elsewhere. Nobody is
         waiting on the guard to act, so this does not ring. */
      "visitor.decision" -> GateAlert.showDecision(applicationContext, data)

      else -> GateAlert.showGeneric(applicationContext, message)
    }
  }

  /**
   * A rotated token is a device that has silently stopped receiving.
   *
   * `super` hands it to JavaScript, which re-registers it with the API — the
   * path that normally runs. The copy stashed here covers the case JavaScript
   * cannot: a rotation delivered while the app is not running. Registering needs
   * the signed-in user's access token, which lives in JavaScript, so the app
   * claims this on next launch.
   */
  override fun onNewToken(token: String) {
    super.onNewToken(token)
    getSharedPreferences("prangan.push", MODE_PRIVATE)
      .edit()
      .putString("pendingToken", token)
      .apply()
  }
}

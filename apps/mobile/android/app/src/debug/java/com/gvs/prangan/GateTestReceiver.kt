package com.gvs.prangan

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Fires a gate alert from the command line. **Debug builds only.**
 *
 * A real gate request arrives as an FCM message, and FCM's receiver is guarded
 * by com.google.android.c2dm.permission.SEND — a permission only Google Play
 * Services holds, which adb cannot borrow and `adb root` cannot grant on a Play
 * Store system image. Without something like this, the full-screen approval
 * screen can only be exercised by owning a Firebase project and pushing to a
 * real device.
 *
 * This receiver lives in src/debug, so it does not exist in a release build at
 * all — not merely disabled, absent. It takes the same data map an FCM message
 * carries and hands it to the same GateAlert entry point, so what runs is the
 * real path: notification, full-screen intent, activity, ringtone.
 *
 *   adb shell am broadcast -a com.gvs.prangan.TEST_GATE \
 *     -n com.gvs.prangan/.GateTestReceiver \
 *     --es name 'Zomato Delivery' --es flatCode 'A-401'
 */
class GateTestReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val keys = listOf(
      "type", "visitorId", "name", "category", "flatCode",
      "purpose", "gateName", "phone", "vehicle", "status",
    )
    val data = keys.mapNotNull { k -> intent.getStringExtra(k)?.let { k to it } }.toMap()

    when (data["type"] ?: "visitor.approval") {
      "visitor.decision" -> GateAlert.showDecision(context.applicationContext, data)
      else -> GateAlert.showApprovalRequest(context.applicationContext, data)
    }
  }
}

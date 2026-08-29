package com.gvs.prangan

import android.app.NotificationManager
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * The JavaScript side of the gate alert.
 *
 * Everything here is something JavaScript cannot do for itself: silence a
 * ringtone owned by a native player, close an activity it did not open, and ask
 * Android 14 about a permission that has no runtime prompt.
 */
class GateModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "GateModule"

  /** Answered — stop the noise before the screen goes away. */
  @ReactMethod
  fun stopRinging() {
    GateAlert.stopRinging()
    GateAlert.stopVibrating(reactContext)
  }

  /** Closes the approval screen, leaving whatever was underneath untouched. */
  @ReactMethod
  fun close() {
    GateAlert.stopRinging()
    GateAlert.stopVibrating(reactContext)
    GateAlert.cancel(reactContext)
    reactContext.currentActivity?.let {
      if (it is GateApprovalActivity) it.finish()
    }
  }

  /** Clears the gate notification without closing anything. */
  @ReactMethod
  fun dismissNotification() {
    GateAlert.cancel(reactContext)
  }

  /**
   * Whether Android will actually honour the full-screen intent.
   *
   * Until Android 14 this was granted to anything that declared it. Since 14 it
   * is reserved for calling and alarm apps unless the user grants it by hand, and
   * without it the gate request degrades to a heads-up notification — still
   * audible, still tappable, but it will not wake a locked phone into the
   * approval screen. The app needs to know which of those it is promising.
   */
  @ReactMethod
  fun canUseFullScreenIntent(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      promise.resolve(true)
      return
    }
    val manager = reactContext.getSystemService(NotificationManager::class.java)
    promise.resolve(manager?.canUseFullScreenIntent() ?: false)
  }

  /** Opens the one Settings page that can grant it. There is no in-app prompt. */
  @ReactMethod
  fun openFullScreenIntentSettings(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      promise.resolve(false)
      return
    }
    try {
      val intent = Intent(
        Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
        Uri.parse("package:${reactContext.packageName}"),
      ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactContext.startActivity(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("settings_unavailable", e.message, e)
    }
  }

  /**
   * A token FCM handed over while the app was not running.
   *
   * Registering it needs the signed-in user's access token, which lives in
   * JavaScript, so the service parks it and the app claims it on next launch.
   */
  @ReactMethod
  fun consumePendingToken(promise: Promise) {
    val prefs = reactContext.getSharedPreferences("prangan.push", android.content.Context.MODE_PRIVATE)
    val token = prefs.getString("pendingToken", null)
    if (token != null) prefs.edit().remove("pendingToken").apply()
    promise.resolve(token)
  }
}

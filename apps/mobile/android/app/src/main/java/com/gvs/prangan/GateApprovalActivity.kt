package com.gvs.prangan

import android.app.KeyguardManager
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

/**
 * The gate approval screen, shown over the lock screen.
 *
 * Launched by the full-screen intent in [GateAlert] when a visitor is sent up to
 * this flat. It behaves like an incoming call: the screen turns on, the activity
 * appears without the phone being unlocked, and the ringtone loops until the
 * resident answers.
 *
 * It is a separate activity from [MainActivity] on purpose. Routing this through
 * the main activity would drop somebody onto the home screen — or onto the
 * sign-in screen — with a modal over it, and would leave the whole app open
 * afterwards. This shows one question, takes one answer, and closes; the app is
 * left exactly as it was.
 *
 * It renders a different registered component ("PranganGateApproval") but shares
 * the one React instance, so the API client and its stored session are already
 * there and no second runtime is started.
 */
class GateApprovalActivity : ReactActivity() {

  override fun getMainComponentName(): String = "PranganGateApproval"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
    object : DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled) {
      /**
       * The visitor, handed to JavaScript as initial props.
       *
       * The alert already carries everything the screen needs to draw itself, so
       * it can render before any network call. It still re-reads the server
       * afterwards — the payload says what was true when the guard pressed the
       * button, and the request may have been answered by somebody else in the
       * meantime.
       */
      override fun getLaunchOptions(): Bundle = Bundle().apply {
        val extras = intent?.extras
        putString("visitorId", extras?.getString("visitorId") ?: "")
        putString("name", extras?.getString("name") ?: "")
        putString("category", extras?.getString("category") ?: "guest")
        putString("flatCode", extras?.getString("flatCode") ?: "")
        putString("purpose", extras?.getString("purpose") ?: "")
        putString("gateName", extras?.getString("gateName") ?: "")
        putString("phone", extras?.getString("phone") ?: "")
        putString("vehicle", extras?.getString("vehicle") ?: "")
        putBoolean("locked", GateAlert.isLocked(this@GateApprovalActivity))
      }
    }

  override fun onCreate(savedInstanceState: Bundle?) {
    showOverLockScreen()
    super.onCreate(savedInstanceState)

    /* The notification has done its job — the screen it points at is now open,
       and leaving it in the shade would let the resident answer twice. */
    GateAlert.cancel(applicationContext)
    GateAlert.startRinging(applicationContext)
  }

  /**
   * Turns the screen on and shows this above the keyguard.
   *
   * The flags were replaced by explicit setters in Android 8.1; both paths are
   * kept because minSdk here is 24. Note this shows *over* the lock screen
   * rather than unlocking it — the resident answers the gate without their PIN,
   * but nothing else in the app is reachable until they do unlock.
   */
  private fun showOverLockScreen() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
      getSystemService(KeyguardManager::class.java)?.requestDismissKeyguard(this, null)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
      )
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
  }

  /** Silence follows the screen, however it was dismissed. */
  override fun onDestroy() {
    GateAlert.stopRinging()
    GateAlert.stopVibrating(applicationContext)
    super.onDestroy()
  }

  /**
   * Back does not answer the gate.
   *
   * Closing the screen is a deliberate "not now" — the request stays pending and
   * the guard is told nothing, which is the only honest reading of a back press.
   */
  @Suppress("DEPRECATION", "MissingSuperCall")
  override fun onBackPressed() {
    finish()
  }
}

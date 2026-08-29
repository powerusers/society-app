package com.gvs.prangan

import android.app.Activity
import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.os.Bundle
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // The app's own modules are not autolinked — only dependencies are.
              add(GatePackage())
            }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
    createNotificationChannels()
    trackForeground()
  }

  /**
   * Whether the app is on screen right now.
   *
   * When it is, the in-app approval prompt already has the resident's attention
   * and a ringing full-screen notification on top of it is just noise — two
   * copies of one question. [GateAlert] checks this and stays quiet.
   *
   * A cold process starts with this false, which is exactly right: if the app
   * was not running, nothing has the resident's attention and the alert should
   * ring.
   */
  private fun trackForeground() {
    registerActivityLifecycleCallbacks(object : ActivityLifecycleCallbacks {
      override fun onActivityResumed(activity: Activity) {
        /* The gate screen itself does not count. It is raised *by* an alert, and
           treating it as "the app is open" would suppress the next visitor's. */
        if (activity !is GateApprovalActivity) foregroundActivities++
      }

      override fun onActivityPaused(activity: Activity) {
        if (activity !is GateApprovalActivity && foregroundActivities > 0) foregroundActivities--
      }

      override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
      override fun onActivityStarted(activity: Activity) {}
      override fun onActivityStopped(activity: Activity) {}
      override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
      override fun onActivityDestroyed(activity: Activity) {}
    })
  }

  companion object {
    @Volatile private var foregroundActivities = 0

    /** True while the main app is on screen. */
    fun isAppInForeground(): Boolean = foregroundActivities > 0
  }

  /**
   * The notification channels this app posts to.
   *
   * On Android 8 and up a notification naming a channel that does not exist is
   * dropped without an error anywhere — and FCM names one via the
   * default_notification_channel_id meta-data in the manifest. Creating the
   * channel here rather than from JavaScript means it exists before the first
   * message can arrive, including the case where a notification is what starts
   * the app.
   *
   * Creating a channel that already exists is a no-op, so this is safe on every
   * launch. Note that importance can only be lowered by the user afterwards,
   * never raised by us — which is the right way round.
   */
  private fun createNotificationChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

    val manager = getSystemService(NotificationManager::class.java) ?: return

    /*
     * A visitor is standing at the gate while the flat decides, so this rings on
     * the ringtone stream rather than chirping on the notification one. That is
     * what the heads-up sounds like when the phone is unlocked and in use; when
     * it is locked, the full-screen intent takes over and GateAlert loops the
     * same ringtone until somebody answers.
     *
     * The id is versioned because **a channel's settings are immutable once
     * created**. Changing the sound or importance in this code does nothing to a
     * device that already has the channel — the user's copy wins forever, which
     * is the point of channels. Tuning any of this later means a new id.
     */
    val ringtone = RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_RINGTONE)
      ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)

    val gate = NotificationChannel(
      GateAlert.CHANNEL_GATE,
      "Gate requests",
      NotificationManager.IMPORTANCE_HIGH,
    ).apply {
      description = "Visitors waiting at the gate for your approval"
      enableVibration(true)
      vibrationPattern = longArrayOf(0, 700, 600, 700)
      setSound(
        ringtone,
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build(),
      )
      /* A gate request is the one thing here worth interrupting for. */
      setBypassDnd(true)
      lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
    }

    /* The pre-release channel, which chirped on the notification stream. Deleting
       it keeps a stale entry out of the app's notification settings. */
    manager.deleteNotificationChannel("gate")

    // Everything else: notices, bills, helpdesk updates. Silent by default.
    val general = NotificationChannel(
      GateAlert.CHANNEL_DEFAULT,
      "Society updates",
      NotificationManager.IMPORTANCE_DEFAULT,
    ).apply {
      description = "Notices, bills and helpdesk updates"
    }

    manager.createNotificationChannels(listOf(gate, general))
  }
}

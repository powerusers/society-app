package com.gvs.prangan

import android.app.KeyguardManager
import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat

/**
 * The gate alert: a full-screen approval request that rings.
 *
 * This is the piece that makes a gate request reach somebody whose phone is
 * locked in a pocket. It is the same mechanism an incoming call or an
 * authenticator prompt uses — a high-importance notification carrying a
 * full-screen intent, which Android launches directly when the screen is off or
 * locked.
 *
 * Worth knowing before changing any of this: **a full-screen intent only
 * auto-launches when the device is locked or the screen is off.** When somebody
 * is actively using their phone, Android deliberately shows a heads-up
 * notification instead and leaves the choice to them. That is not a limitation
 * to work around — background activity launches are blocked outright since
 * Android 10, and the full-screen intent is the sanctioned exception. The
 * heads-up still rings, and tapping it opens the same screen.
 */
object GateAlert {

  /* Versioned: a notification channel's settings are immutable once created, so
     changing the sound or importance needs a new id to take effect on devices
     that already have the old one. See createNotificationChannels(). */
  const val CHANNEL_GATE = "gate_v2"
  const val CHANNEL_DEFAULT = "default"

  /** One live gate request at a time; a second replaces the first in the shade. */
  private const val NOTIFICATION_ID = 4101

  private var player: MediaPlayer? = null

  /* ------------------------------------------------------------ notify -- */

  fun showApprovalRequest(context: Context, data: Map<String, String>) {
    /* The app is already on screen, so its own prompt is showing this visitor.
       Ringing over the top of it would ask the same question twice. */
    if (MainApplication.isAppInForeground()) return

    val name = data["name"] ?: "Someone"
    val flat = data["flatCode"] ?: ""
    val gate = data["gateName"] ?: ""
    val category = data["category"] ?: "guest"

    val where = if (gate.isNotBlank()) " at $gate" else ""
    val title = "${categoryLabel(category)} at the gate"
    val body = if (flat.isNotBlank()) "$name is waiting$where for Flat $flat." else "$name is waiting$where."

    val fullScreen = Intent(context, GateApprovalActivity::class.java).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      data.forEach { (k, v) -> putExtra(k, v) }
    }

    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    val pending = PendingIntent.getActivity(context, NOTIFICATION_ID, fullScreen, flags)

    val notification = NotificationCompat.Builder(context, CHANNEL_GATE)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setPriority(NotificationCompat.PRIORITY_MAX)
      /* CATEGORY_CALL is what earns this a heads-up over other notifications and
         lets it through some Do Not Disturb configurations. A visitor standing
         at the gate is the closest thing this app has to a ringing phone. */
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setAutoCancel(true)
      .setOngoing(true)
      .setContentIntent(pending)
      /* `true` means: show this even if the user has already been notified.
         Android launches it directly when the screen is locked or off, and falls
         back to a heads-up when it is not. */
      .setFullScreenIntent(pending, true)
      .build()

    NotificationManagerCompatSafe.notify(context, NOTIFICATION_ID, notification)
  }

  /**
   * The flat answered. Goes to the guard, quietly — they are not being asked for
   * anything, only told. Default channel, no ringing, dismissible.
   */
  fun showDecision(context: Context, data: Map<String, String>) {
    val name = data["name"] ?: "The visitor"
    val flat = data["flatCode"] ?: ""
    val approved = data["status"] == "approved"

    val title = if (approved) "Entry approved" else "Entry denied"
    val body = if (flat.isNotBlank()) {
      "Flat $flat ${if (approved) "approved" else "denied"} $name."
    } else {
      "$name was ${if (approved) "approved" else "denied"}."
    }

    NotificationManagerCompatSafe.notify(
      context,
      NOTIFICATION_ID + 1,
      NotificationCompat.Builder(context, CHANNEL_DEFAULT)
        .setSmallIcon(R.mipmap.ic_launcher)
        .setContentTitle(title)
        .setContentText(body)
        .setAutoCancel(true)
        .setContentIntent(openApp(context))
        .build(),
    )
  }

  /** Anything else the API sends: notices, bills, helpdesk replies. */
  fun showGeneric(context: Context, message: com.google.firebase.messaging.RemoteMessage) {
    val title = message.notification?.title ?: message.data["title"] ?: return
    val body = message.notification?.body ?: message.data["body"] ?: ""

    NotificationManagerCompatSafe.notify(
      context,
      NOTIFICATION_ID + 2,
      NotificationCompat.Builder(context, CHANNEL_DEFAULT)
        .setSmallIcon(R.mipmap.ic_launcher)
        .setContentTitle(title)
        .setContentText(body)
        .setStyle(NotificationCompat.BigTextStyle().bigText(body))
        .setAutoCancel(true)
        .setContentIntent(openApp(context))
        .build(),
    )
  }

  private fun openApp(context: Context): PendingIntent {
    val intent = Intent(context, MainActivity::class.java)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    return PendingIntent.getActivity(
      context, 0, intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  fun cancel(context: Context) {
    val manager = context.getSystemService(NotificationManager::class.java)
    manager?.cancel(NOTIFICATION_ID)
  }

  /* ------------------------------------------------------------- sound -- */

  /**
   * Starts the ringtone, looping until somebody answers.
   *
   * Deliberately the ringtone stream rather than the notification stream: a
   * notification chirp at notification volume is exactly what this must not be.
   * The point is to be heard from a pocket while a guard waits.
   */
  fun startRinging(context: Context) {
    stopRinging()

    val uri = RingtoneManager.getActualDefaultRingtoneUri(context, RingtoneManager.TYPE_RINGTONE)
      ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
      ?: return

    try {
      player = MediaPlayer().apply {
        setDataSource(context, uri)
        setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build(),
        )
        isLooping = true
        prepare()
        start()
      }
    } catch (e: Exception) {
      /* A missing or unreadable ringtone must not take down the approval screen;
         the request still needs answering, silently if it comes to that. */
      player = null
    }

    vibrate(context)
  }

  fun stopRinging() {
    try {
      player?.let { if (it.isPlaying) it.stop(); it.release() }
    } catch (e: Exception) {
      /* already released */
    }
    player = null
  }

  private fun vibrate(context: Context) {
    try {
      val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        (context.getSystemService(VibratorManager::class.java))?.defaultVibrator
      } else {
        @Suppress("DEPRECATION")
        context.getSystemService(Vibrator::class.java)
      } ?: return

      // Ring-ring, pause, repeat — from index 0, so it loops with the ringtone.
      val pattern = longArrayOf(0, 700, 600, 700, 1500)
      vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0))
    } catch (e: Exception) {
      /* no vibrator, or the permission was stripped by an OEM build */
    }
  }

  fun stopVibrating(context: Context) {
    try {
      val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        (context.getSystemService(VibratorManager::class.java))?.defaultVibrator
      } else {
        @Suppress("DEPRECATION")
        context.getSystemService(Vibrator::class.java)
      }
      vibrator?.cancel()
    } catch (e: Exception) {
      /* nothing to cancel */
    }
  }

  /* ------------------------------------------------------------ helpers -- */

  fun isLocked(context: Context): Boolean {
    val keyguard = context.getSystemService(KeyguardManager::class.java) ?: return false
    return keyguard.isKeyguardLocked
  }

  /** Mirrors VISITOR_CATEGORY_LABELS in packages/shared/src/entities.js. */
  private fun categoryLabel(category: String): String = when (category) {
    "delivery" -> "Delivery"
    "service" -> "Service"
    "cab" -> "Cab"
    "staff" -> "Daily help"
    else -> "Guest"
  }
}

/** Posting needs the runtime permission on 13+; without it notify() throws. */
private object NotificationManagerCompatSafe {
  fun notify(context: Context, id: Int, notification: Notification) {
    try {
      context.getSystemService(NotificationManager::class.java)?.notify(id, notification)
    } catch (e: SecurityException) {
      /* POST_NOTIFICATIONS was refused. Nothing to do but stay quiet — the app
         still shows the request the next time it is opened. */
    }
  }
}

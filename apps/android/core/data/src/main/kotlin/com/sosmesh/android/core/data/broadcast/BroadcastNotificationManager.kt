package com.sosmesh.android.core.data.broadcast

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat

class BroadcastNotificationManager(private val context: Context) {
    private val notificationManager =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    init {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel =
                NotificationChannel(
                    CHANNEL_ID,
                    "Broadcast Notifications",
                    NotificationManager.IMPORTANCE_HIGH,
                ).apply {
                    description = "Server broadcast notifications"
                }
            notificationManager.createNotificationChannel(channel)
        }
    }

    fun showNotification(broadcast: ServerBroadcast) {
        val notification =
            NotificationCompat
                .Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(broadcast.title)
                .setContentText(broadcast.body)
                .setPriority(
                    when (broadcast.severity) {
                        "critical" -> NotificationCompat.PRIORITY_MAX
                        "warning" -> NotificationCompat.PRIORITY_HIGH
                        else -> NotificationCompat.PRIORITY_DEFAULT
                    },
                ).setAutoCancel(true)
                .build()

        notificationManager.notify(broadcast.id.hashCode(), notification)
    }

    companion object {
        private const val CHANNEL_ID = "broadcast_notifications"
    }
}

package com.sosmesh.android.core.data.broadcast

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
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
        val builder =
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

        if (broadcast.kind == "relay_request") {
            val enableIntent = Intent(context, BroadcastActionReceiver::class.java).apply {
                action = ACTION_ENABLE_RELAY
                putExtra(EXTRA_BROADCAST_ID, broadcast.id)
            }
            val enablePendingIntent = PendingIntent.getBroadcast(
                context,
                broadcast.id.hashCode(),
                enableIntent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )

            val cancelIntent = Intent(context, BroadcastActionReceiver::class.java).apply {
                action = ACTION_CANCEL
                putExtra(EXTRA_BROADCAST_ID, broadcast.id)
            }
            val cancelPendingIntent = PendingIntent.getBroadcast(
                context,
                broadcast.id.hashCode() + 1,
                cancelIntent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )

            val enableText = context.getString(
                context.resources.getIdentifier("broadcast_relay_request_action_enable", "string", context.packageName)
            )
            val cancelText = context.getString(
                context.resources.getIdentifier("broadcast_relay_request_action_cancel", "string", context.packageName)
            )

            builder.addAction(0, enableText, enablePendingIntent)
            builder.addAction(0, cancelText, cancelPendingIntent)
        }

        notificationManager.notify(broadcast.id.hashCode(), builder.build())
    }

    companion object {
        private const val CHANNEL_ID = "broadcast_notifications"
        const val ACTION_ENABLE_RELAY = "com.sosmesh.android.ENABLE_RELAY"
        const val ACTION_CANCEL = "com.sosmesh.android.BROADCAST_CANCEL"
        const val EXTRA_BROADCAST_ID = "broadcast_id"
    }
}

package com.sosmesh.android.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.sosmesh.android.R

/**
 * Foreground service (connectedDevice). Visible notification only; no background guarantee.
 */
class MeshConnectionForegroundService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(
        intent: Intent?,
        flags: Int,
        startId: Int,
    ): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            else -> {
                createChannel()
                val pending = intent?.getIntExtra(EXTRA_PENDING_COUNT, 0) ?: 0
                val notification = buildNotification(pending)
                startForeground(NOTIFICATION_ID, notification)
                return START_STICKY
            }
        }
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel =
                NotificationChannel(
                    CHANNEL_ID,
                    getString(R.string.notification_channel_mesh),
                    NotificationManager.IMPORTANCE_LOW,
                )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(pendingCount: Int): Notification {
        val body =
            if (pendingCount > 0) {
                getString(R.string.notification_mesh_body_pending, pendingCount)
            } else {
                getString(R.string.notification_mesh_body)
            }
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.notification_mesh_title))
            .setContentText(body)
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setOngoing(true)
            .build()
    }

    companion object {
        const val ACTION_START = "com.sosmesh.android.action.RELAY_FOREGROUND_START"
        const val ACTION_STOP = "com.sosmesh.android.action.RELAY_FOREGROUND_STOP"
        const val EXTRA_PENDING_COUNT = "pending_count"
        private const val CHANNEL_ID = "mesh_connected_device"
        private const val NOTIFICATION_ID = 12012
    }
}

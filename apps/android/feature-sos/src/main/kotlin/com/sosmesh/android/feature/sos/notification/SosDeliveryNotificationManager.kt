package com.sosmesh.android.feature.sos.notification

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.sosmesh.android.feature.sos.R
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SosDeliveryNotificationManager
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
        private val openCaseTracker: com.sosmesh.android.feature.sos.OpenCaseTracker,
    ) {
        internal val pendingSosIds = mutableSetOf<String>()
        private val notificationManager = NotificationManagerCompat.from(context)
        private val _pendingDeliveryDialogs = mutableSetOf<String>()

        init {
            createNotificationChannel()
        }

        private fun createNotificationChannel() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel =
                    NotificationChannel(
                        CHANNEL_ID,
                        context.getString(R.string.notification_channel_sos_delivery),
                        NotificationManager.IMPORTANCE_DEFAULT,
                    ).apply {
                        description = context.getString(R.string.notification_channel_sos_delivery_desc)
                    }
                notificationManager.createNotificationChannel(channel)
            }
        }

        fun trackPendingSos(sosId: String) {
            pendingSosIds.add(sosId)
        }

        fun notifyServerAccepted(sosId: String) {
            if (!pendingSosIds.contains(sosId)) return
            pendingSosIds.remove(sosId)

            if (!openCaseTracker.hasShownDeliveryDialog(sosId)) {
                synchronized(_pendingDeliveryDialogs) {
                    _pendingDeliveryDialogs.add(sosId)
                }
            }

            if (!hasNotificationPermission()) return

            val intent =
                Intent(Intent.ACTION_VIEW).apply {
                    setPackage(context.packageName)
                    putExtra("navigate_to", "status")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                }

            val pendingIntent =
                PendingIntent.getActivity(
                    context,
                    sosId.hashCode(),
                    intent,
                    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
                )

            val notification =
                NotificationCompat
                    .Builder(context, CHANNEL_ID)
                    .setSmallIcon(android.R.drawable.ic_dialog_info)
                    .setContentTitle(context.getString(R.string.notification_sos_delivered_title))
                    .setContentText(context.getString(R.string.notification_sos_delivered_body))
                    .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                    .setContentIntent(pendingIntent)
                    .setAutoCancel(true)
                    .build()

            notificationManager.notify(sosId.hashCode(), notification)
        }

        fun getPendingDeliveryDialog(): String? {
            synchronized(_pendingDeliveryDialogs) {
                return _pendingDeliveryDialogs.firstOrNull()
            }
        }

        fun markDeliveryDialogShown(sosId: String) {
            synchronized(_pendingDeliveryDialogs) {
                _pendingDeliveryDialogs.remove(sosId)
            }
            openCaseTracker.markDeliveryDialogShown(sosId)
        }

        private fun hasNotificationPermission(): Boolean {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                return ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.POST_NOTIFICATIONS,
                ) == PackageManager.PERMISSION_GRANTED
            }
            return true
        }

        companion object {
            private const val CHANNEL_ID = "sos_delivery"
        }
    }

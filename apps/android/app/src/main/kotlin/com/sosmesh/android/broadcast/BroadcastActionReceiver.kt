package com.sosmesh.android.broadcast

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.sosmesh.android.core.data.broadcast.BroadcastNotificationManager
import com.sosmesh.android.core.data.relay.RelayController
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class BroadcastActionReceiver : BroadcastReceiver() {
    @Inject
    lateinit var relayController: RelayController

    override fun onReceive(context: Context, intent: Intent) {
        val broadcastId = intent.getStringExtra(BroadcastNotificationManager.EXTRA_BROADCAST_ID) ?: return
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        when (intent.action) {
            BroadcastNotificationManager.ACTION_ENABLE_RELAY -> {
                relayController.setRelayEnabled(enabled = true)
                notificationManager.cancel(broadcastId.hashCode())
            }
            BroadcastNotificationManager.ACTION_CANCEL -> {
                notificationManager.cancel(broadcastId.hashCode())
            }
        }
    }
}

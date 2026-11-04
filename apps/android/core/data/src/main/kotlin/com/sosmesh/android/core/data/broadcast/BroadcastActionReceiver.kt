package com.sosmesh.android.core.data.broadcast

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.sosmesh.android.feature.relay.settings.RelaySettingsPort
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class BroadcastActionReceiver : BroadcastReceiver() {
    @Inject
    lateinit var relaySettings: RelaySettingsPort

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    override fun onReceive(context: Context, intent: Intent) {
        val broadcastId = intent.getStringExtra(BroadcastNotificationManager.EXTRA_BROADCAST_ID) ?: return
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        when (intent.action) {
            BroadcastNotificationManager.ACTION_ENABLE_RELAY -> {
                scope.launch {
                    relaySettings.setRelayEnabled(true)
                }
                notificationManager.cancel(broadcastId.hashCode())
            }
            BroadcastNotificationManager.ACTION_CANCEL -> {
                notificationManager.cancel(broadcastId.hashCode())
            }
        }
    }
}

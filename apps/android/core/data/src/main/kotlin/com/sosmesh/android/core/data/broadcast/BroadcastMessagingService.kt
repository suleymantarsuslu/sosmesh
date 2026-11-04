package com.sosmesh.android.core.data.broadcast

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class BroadcastMessagingService : FirebaseMessagingService() {
    @Inject
    lateinit var poller: BroadcastPoller

    @Inject
    lateinit var pushTokenManager: PushTokenManager

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        scope.launch {
            pushTokenManager.registerToken(token)
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        val broadcastId = message.data["broadcastId"]
        if (broadcastId != null) {
            scope.launch {
                poller.fetchAndProcess()
            }
        }
    }
}

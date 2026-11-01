package com.sosmesh.android.wear.companion

import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService
import com.sosmesh.android.core.wear.companion.protocol.WearCompanionCodec
import com.sosmesh.android.core.wear.companion.protocol.WearCompanionPaths
import com.sosmesh.android.core.wear.companion.watch.WearSosCoordinator

class WearPhoneAckListenerService : WearableListenerService() {
    private val coordinator: WearSosCoordinator by lazy {
        WearAppCoordinatorHolder.get(applicationContext)
    }

    override fun onMessageReceived(messageEvent: MessageEvent) {
        if (messageEvent.path != WearCompanionPaths.PHONE_ACK) {
            return
        }
        val ack = WearCompanionCodec.decodeAck(messageEvent.data)
        coordinator.applyPhoneAck(ack, System.currentTimeMillis())
    }
}

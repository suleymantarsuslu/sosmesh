package com.sosmesh.android.core.wear.companion.phone

import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService
import com.sosmesh.android.core.wear.companion.protocol.WearCompanionPaths
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class WearCompanionListenerService : WearableListenerService() {
    @Inject
    lateinit var ingress: PhoneWearSosIngress

    @Inject
    lateinit var ackSender: PhoneWearAckSender

    override fun onMessageReceived(messageEvent: MessageEvent) {
        if (messageEvent.path != WearCompanionPaths.SOS_CREATE) {
            return
        }
        val nowMs = System.currentTimeMillis()
        val result = ingress.handleCreatePayload(messageEvent.data, nowMs)
        ackSender.sendAck(messageEvent.sourceNodeId, ingress.buildAckBytes(result))
    }
}

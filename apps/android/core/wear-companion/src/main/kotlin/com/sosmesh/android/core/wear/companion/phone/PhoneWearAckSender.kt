package com.sosmesh.android.core.wear.companion.phone

import android.content.Context
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.Wearable
import com.sosmesh.android.core.wear.companion.protocol.WearCompanionPaths
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PhoneWearAckSender
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) {
        fun sendAck(
            targetNodeId: String,
            payload: ByteArray,
        ) {
            val client: MessageClient = Wearable.getMessageClient(context)
            client.sendMessage(targetNodeId, WearCompanionPaths.PHONE_ACK, payload)
        }
    }

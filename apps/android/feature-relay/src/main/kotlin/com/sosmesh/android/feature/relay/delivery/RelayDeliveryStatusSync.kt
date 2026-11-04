package com.sosmesh.android.feature.relay.delivery

import com.sosmesh.android.feature.relay.RelayDeliveryCounter
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RelayDeliveryStatusSync
    @Inject
    constructor(
        private val client: RelayDeliveryStatusClient,
        private val counter: RelayDeliveryCounter,
    ) {
        suspend fun syncPendingCarriedMessages() {
            val pending = counter.getPendingCarriedIds()
            if (pending.isEmpty()) {
                return
            }

            val delivered = client.checkDeliveryStatus(pending)
            if (delivered.isNotEmpty()) {
                counter.markCarriedMessagesDelivered(delivered)
            }
        }
    }

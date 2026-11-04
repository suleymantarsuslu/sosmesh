package com.sosmesh.android.feature.relay.mesh

import com.sosmesh.android.feature.relay.RelayDeliveryCounter
import com.sosmesh.android.meshv2.v2.DeliveryTombstone
import com.sosmesh.android.meshv2.v2.MeshV2Runtime
import com.sosmesh.contracts.transport.OutboxQueueAdapter
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RelayDeliveryTracker
    @Inject
    constructor(
        private val counter: RelayDeliveryCounter,
        private val runtime: MeshV2Runtime,
        private val outbox: OutboxQueueAdapter,
    ) {
        fun start() {
            val existingListener = runtime.tombstoneListener
            runtime.tombstoneListener = { t ->
                existingListener?.invoke(t)
                onTombstoneReceived(t)
            }
        }

        private fun onTombstoneReceived(tombstone: DeliveryTombstone) {
            val pendingIds = counter.getPendingCarriedIds()
            if (tombstone.messageId in pendingIds) {
                counter.markCarriedMessagesDelivered(listOf(tombstone.messageId))
            }
        }

        suspend fun recordCarriedMessagesFromOutbox() {
            val relayRows = outbox.listAll().filter { it.origin == "relay" }
            for (row in relayRows) {
                counter.recordCarriedMessage(row.sosId)
            }
        }
    }

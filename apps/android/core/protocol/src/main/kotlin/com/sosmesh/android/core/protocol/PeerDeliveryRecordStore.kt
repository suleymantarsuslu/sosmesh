package com.sosmesh.android.core.protocol

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Tracks which peers have successfully received each message for fan-out delivery.
 * A message stays in LOCAL_SAVED until all currently discovered peers have received it.
 */
@Singleton
class PeerDeliveryRecordStore
    @Inject
    constructor() {
        private val mutex = Mutex()
        private val deliveredPeers = mutableMapOf<String, MutableSet<String>>()

        suspend fun recordDelivery(
            sosId: String,
            peerId: String,
        ) = mutex.withLock {
            deliveredPeers.getOrPut(sosId) { mutableSetOf() }.add(peerId)
        }

        suspend fun getDeliveredPeers(sosId: String): Set<String> =
            mutex.withLock {
                deliveredPeers[sosId]?.toSet() ?: emptySet()
            }

        suspend fun hasDeliveredToAll(
            sosId: String,
            allDiscoveredPeerIds: Set<String>,
        ): Boolean =
            mutex.withLock {
                val delivered = deliveredPeers[sosId] ?: return@withLock allDiscoveredPeerIds.isEmpty()
                allDiscoveredPeerIds.isNotEmpty() && delivered.containsAll(allDiscoveredPeerIds)
            }

        suspend fun clearMessageRecords(sosId: String) =
            mutex.withLock {
                deliveredPeers.remove(sosId)
            }

        suspend fun getAllTrackedMessages(): Set<String> =
            mutex.withLock {
                deliveredPeers.keys.toSet()
            }
    }

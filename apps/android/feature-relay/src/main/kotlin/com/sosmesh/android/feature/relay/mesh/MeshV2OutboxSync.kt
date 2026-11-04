package com.sosmesh.android.feature.relay.mesh

import com.sosmesh.android.core.data.di.OutboxIoScope
import com.sosmesh.android.feature.relay.uplink.IngestPacketHash
import com.sosmesh.android.meshv2.v2.DeliveryTombstone
import com.sosmesh.android.meshv2.v2.MeshV2Runtime
import com.sosmesh.contracts.transport.OutboxQueueAdapter
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import java.util.Base64
import javax.inject.Inject
import javax.inject.Singleton

/**
 * mesh-v2 §6 effects on the persistent outbox: a verified tombstone deletes the relayed copy (origin "relay") whose
 * packetHash matches and marks the device's own entry SERVER_ACCEPTED (history kept). Hash mismatch ⇒ keep.
 */
@Singleton
class MeshV2OutboxSync
    @Inject
    constructor(
        private val outbox: OutboxQueueAdapter,
        private val runtime: MeshV2Runtime,
        private val ioScope: OutboxIoScope,
    ) {
        fun start() {
            runtime.tombstoneListener = { t -> ioScope.launchOutboxWork { apply(t) } }
        }

        suspend fun apply(t: DeliveryTombstone) {
            val rows = outbox.listAll().filter { it.sosId == t.messageId }
            for (row in rows) {
                if (packetHashOf(row.encryptedBlobBase64) != t.packetHash) continue
                if (row.origin == "relay") {
                    outbox.deleteEntry(row.sosId, row.digest)
                    runtime.carryMeta.remove(row.sosId)
                } else if (row.state !in DONE_STATES) {
                    runCatching { outbox.updateState(row.sosId, row.digest, "SERVER_ACCEPTED", System.currentTimeMillis()) }
                }
            }
        }

        private fun packetHashOf(blob: String): String? =
            try {
                val obj = Json.parseToJsonElement(String(Base64.getDecoder().decode(blob), Charsets.UTF_8)) as JsonObject
                IngestPacketHash.computePacketHash(obj)
            } catch (_: Exception) {
                null
            }

        private companion object {
            val DONE_STATES = setOf("SERVER_ACCEPTED", "OPERATOR_SEEN", "CASE_IN_PROGRESS")
        }
    }

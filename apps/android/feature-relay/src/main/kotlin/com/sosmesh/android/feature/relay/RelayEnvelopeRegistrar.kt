package com.sosmesh.android.feature.relay

import com.sosmesh.android.feature.relay.upload.RelayUploadCommands
import com.sosmesh.ble.BleProtocol
import com.sosmesh.contracts.transport.EnqueueInput
import com.sosmesh.contracts.transport.OutboxQueueAdapter
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.util.Base64
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Stores received SOS wire bytes in outbox without decrypting payload (relay must not read plaintext).
 */
@Singleton
class RelayEnvelopeRegistrar
    @Inject
    constructor(
        private val outbox: OutboxQueueAdapter,
        private val uploadScheduler: RelayUploadCommands,
        private val deliveryCounter: RelayDeliveryCounter,
    ) {
        /** Stores verbatim L2 v1 wire bytes for upload / forwarding (mesh-v2: the persisted part of the carry store). */
        suspend fun registerL2(
            messageId: String,
            l2Bytes: ByteArray,
            nowMs: Long,
        ): Result<Unit> =
            try {
                val digest = Base64.getEncoder().encodeToString(BleProtocol.calculateSHA256(l2Bytes))
                if (outbox.getByKey(messageId, digest) == null) {
                    outbox.enqueue(
                        EnqueueInput(
                            sosId = messageId,
                            digest = digest,
                            origin = "relay",
                            encryptedBlobBase64 = Base64.getEncoder().encodeToString(l2Bytes),
                        ),
                        nowMs,
                    )
                    deliveryCounter.recordCarriedMessage(messageId)
                    uploadScheduler.scheduleUpload(nowMs)
                }
                Result.success(Unit)
            } catch (ex: Exception) {
                Result.failure(ex)
            }

        suspend fun registerFromWirePayload(
            payload: ByteArray,
            nowMs: Long,
        ): Result<Unit> {
            return try {
                val root = Json.parseToJsonElement(String(payload, Charsets.UTF_8)).jsonObject
                val protocolVersion = root["protocolVersion"]?.jsonPrimitive?.content?.toIntOrNull()
                val sosId =
                    if (protocolVersion == 2) {
                        root.getValue("messageId").jsonPrimitive.content
                    } else {
                        root.getValue("id").jsonPrimitive.content
                    }
                val digest = Base64.getEncoder().encodeToString(BleProtocol.calculateSHA256(payload))
                val blob = Base64.getEncoder().encodeToString(payload)
                outbox.enqueue(
                    EnqueueInput(
                        sosId = sosId,
                        digest = digest,
                        origin = "relay",
                        encryptedBlobBase64 = blob,
                    ),
                    nowMs,
                )
                deliveryCounter.recordCarriedMessage(sosId)
                uploadScheduler.scheduleUpload(nowMs)
                Result.success(Unit)
            } catch (ex: Exception) {
                Result.failure(ex)
            }
        }
    }

package com.sosmesh.android.core.wear.companion.phone

import com.sosmesh.android.core.data.sos.LocationSnapshot
import com.sosmesh.android.core.data.sos.SosComposeRequest
import com.sosmesh.android.core.data.sos.SosMessageComposer
import com.sosmesh.android.core.model.SosType
import com.sosmesh.android.core.wear.companion.protocol.WearCompanionCodec
import com.sosmesh.android.core.wear.companion.protocol.WearPhoneAckStatus
import com.sosmesh.android.core.wear.companion.protocol.WearPhoneAckWire
import com.sosmesh.android.core.wear.companion.protocol.WearSosCreateWire
import com.sosmesh.contracts.transport.EnqueueInput
import com.sosmesh.contracts.transport.OutboxQueueAdapter
import javax.inject.Inject
import javax.inject.Singleton

data class PhoneWearIngressResult(
    val ack: WearPhoneAckWire,
    val enqueued: Boolean,
)

@Singleton
class PhoneWearSosIngress
    @Inject
    constructor(
        private val composer: SosMessageComposer,
        private val outbox: OutboxQueueAdapter,
    ) {
        suspend fun handleCreatePayload(
            payload: ByteArray,
            nowMs: Long,
        ): PhoneWearIngressResult {
            val wire = WearCompanionCodec.decodeCreate(payload)
            validate(wire)
            val existing = outbox.listAll().firstOrNull { it.sosId == wire.messageId }
            if (existing != null) {
                return PhoneWearIngressResult(
                    ack =
                        WearPhoneAckWire(
                            messageId = wire.messageId,
                            nonce = wire.nonce,
                            status = WearPhoneAckStatus.DUPLICATE,
                            outboxDigest = existing.digest,
                            phoneNowMs = nowMs,
                            detail = "already_in_outbox",
                        ),
                    enqueued = false,
                )
            }
            val sosType = SosType.fromWire(wire.sosType) ?: SosType.DIGER
            val composed =
                composer.compose(
                    SosComposeRequest(
                        sosType = sosType,
                        personCount = wire.personCount,
                        note = wire.note,
                        location = LocationSnapshot.unknown(),
                        languageTag = wire.language,
                        nowMs = nowMs,
                        messageIdOverride = wire.messageId,
                    ),
                )
            outbox.enqueue(
                EnqueueInput(
                    sosId = wire.messageId,
                    digest = composed.digest,
                    origin = "wear_os",
                    encryptedBlobBase64 = composed.encryptedBlobBase64,
                ),
                nowMs,
            )
            return PhoneWearIngressResult(
                ack =
                    WearPhoneAckWire(
                        messageId = wire.messageId,
                        nonce = wire.nonce,
                        status = WearPhoneAckStatus.QUEUED,
                        outboxDigest = composed.digest,
                        phoneNowMs = nowMs,
                    ),
                enqueued = true,
            )
        }

        fun buildAckBytes(result: PhoneWearIngressResult): ByteArray = WearCompanionCodec.encodeAck(result.ack)

        private fun validate(wire: WearSosCreateWire) {
            require(wire.version == 1) { "unsupported version" }
            require(wire.messageId.isNotBlank()) { "messageId required" }
            require(wire.nonce.isNotBlank()) { "nonce required" }
        }
    }

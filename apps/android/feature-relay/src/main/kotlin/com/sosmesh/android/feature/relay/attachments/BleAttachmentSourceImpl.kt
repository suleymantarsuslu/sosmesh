package com.sosmesh.android.feature.relay.attachments

import android.content.Context
import com.sosmesh.android.core.protocol.BleAttachmentBlob
import com.sosmesh.android.core.protocol.BleAttachmentSource
import com.sosmesh.android.core.protocol.BleAttachmentWire
import com.sosmesh.android.feature.sos.attachment.AttachmentPendingStore
import com.sosmesh.contracts.Crypto
import com.sosmesh.contracts.CryptoConfig
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.io.File
import java.security.MessageDigest
import java.util.Base64
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Sender side of the BLE attachment hop: shrinks the pending photo/voice copies, encrypts them with the existing
 * server-key scheme (AAD binds purpose, sosId, attachmentId, kind) and hands them out one at a time per peer.
 * The sender's originals stay queued for its own direct upload.
 */
@Singleton
class BleAttachmentSourceImpl
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
        private val pendingStore: AttachmentPendingStore,
        private val cryptoConfig: CryptoConfig,
    ) : BleAttachmentSource {
        private class Prepared(val attachmentId: String, val blob: BleAttachmentBlob)

        private val mutex = Mutex()
        private val prepared = mutableMapOf<String, List<Prepared>>()
        private val delivered = mutableSetOf<String>()
        private val attempts = mutableMapOf<String, Int>()

        override suspend fun nextFor(
            sosId: String,
            peerId: String,
        ): BleAttachmentBlob? =
            mutex.withLock {
                preparedFor(sosId).firstOrNull { open(sosId, it.attachmentId, peerId) }?.blob
            }

        override suspend fun hasPending(
            sosId: String,
            peerId: String,
        ): Boolean =
            mutex.withLock {
                if (pendingStore.listBySosId(sosId).isEmpty()) return@withLock false
                preparedFor(sosId).any { open(sosId, it.attachmentId, peerId) }
            }

        override suspend fun markDelivered(
            sosId: String,
            attachmentId: String,
            peerId: String,
        ) {
            mutex.withLock { delivered.add(key(sosId, attachmentId, peerId)) }
        }

        override suspend fun markFailed(
            sosId: String,
            attachmentId: String,
            peerId: String,
        ) {
            mutex.withLock { attempts.merge(key(sosId, attachmentId, peerId), 1, Int::plus) }
        }

        private fun open(
            sosId: String,
            attachmentId: String,
            peerId: String,
        ): Boolean {
            val k = key(sosId, attachmentId, peerId)
            return k !in delivered && (attempts[k] ?: 0) < MAX_ATTEMPTS_PER_PEER
        }

        private fun key(
            sosId: String,
            attachmentId: String,
            peerId: String,
        ) = "$sosId|$attachmentId|$peerId"

        private fun preparedFor(sosId: String): List<Prepared> {
            prepared[sosId]?.let { return it }
            val built =
                pendingStore.listBySosId(sosId)
                    .filter { it.kind == "image" || it.kind == "audio" }
                    .take(BleAttachmentWire.MAX_ATTACHMENTS_PER_SOS)
                    .mapNotNull { buildBlob(sosId, it.kind, File(it.filePath)) }
            if (built.isNotEmpty()) prepared[sosId] = built
            return built
        }

        private fun buildBlob(
            sosId: String,
            kind: String,
            file: File,
        ): Prepared? {
            if (!file.exists()) return null
            return try {
                val shrunk =
                    if (kind == "image") {
                        BleAttachmentShrinker.shrinkImage(file)
                    } else {
                        BleAttachmentShrinker.shrinkAudio(file, File(context.cacheDir, "ble_att"))
                    } ?: return null
                val mime = if (kind == "image") "image/jpeg" else "audio/mp4"
                val attachmentId = sha256Hex((sosId + "|" + file.absolutePath).toByteArray()).take(32)
                val inner =
                    JsonObject(
                        mapOf(
                            "mime" to JsonPrimitive(mime),
                            "sha256" to JsonPrimitive(sha256Hex(file.readBytes())),
                            "data" to JsonPrimitive(Base64.getEncoder().encodeToString(shrunk)),
                        ),
                    ).toString().toByteArray(Charsets.UTF_8)
                val envelope = mapOf<String, Any?>("purpose" to "attachment", "sosId" to sosId, "attachmentId" to attachmentId, "kind" to kind)
                val enc = Crypto.encryptPayload(inner, envelope, cryptoConfig)
                val payload =
                    BleAttachmentWire.encode(
                        sosId = sosId,
                        attachmentId = attachmentId,
                        kind = kind,
                        nonce = enc.nonce,
                        ephemeralPublicKey = enc.ephemeralPublicKey,
                        keyId = enc.keyId,
                        ciphertext = Base64.getDecoder().decode(enc.ciphertext),
                    )
                Prepared(attachmentId, BleAttachmentBlob(attachmentId, BleAttachmentWire.digestOf(payload), payload))
            } catch (_: Throwable) {
                null
            }
        }

        private fun sha256Hex(bytes: ByteArray): String =
            MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

        private companion object {
            const val MAX_ATTEMPTS_PER_PEER = 3
        }
    }

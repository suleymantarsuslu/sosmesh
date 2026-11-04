package com.sosmesh.android.meshv2.v2

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.security.KeyFactory
import java.security.Signature
import java.security.spec.X509EncodedKeySpec
import java.time.Instant
import java.util.Base64

/** §6: the /v1/ingest receipt plus unsigned hopsLeft. */
@Serializable
data class DeliveryTombstone(
    val ackType: String = ACK_TYPE,
    val messageId: String,
    val packetHash: String,
    val timestamp: String,
    val signature: String,
    val hopsLeft: Int = MeshV2Wire.MAX_HOPS,
) {
    val messageKey: MessageKey get() = MeshV2Wire.messageKey(messageId)

    fun signedPayload(): String = "$ACK_TYPE|$messageId|$packetHash|$timestamp"

    companion object {
        const val ACK_TYPE = "SERVER_ACCEPTED"
    }
}

@Serializable
data class TombstoneBatchV2(
    val kind: String = KIND,
    val v: Int = 2,
    val items: List<DeliveryTombstone>,
) {
    companion object {
        const val KIND = "TOMBSTONES"
        const val MAX_ITEMS = 16
    }
}

@Serializable
data class ReceiptLookupItem(val messageId: String, val packetHash: String)

@Serializable
data class ReceiptLookupRequest(val items: List<ReceiptLookupItem>)

@Serializable
data class ReceiptLookupResponse(
    @SerialName("receipts") val receipts: List<DeliveryTombstone> = emptyList(),
)

fun interface Ed25519Verifier {
    fun verify(
        payload: ByteArray,
        signature: ByteArray,
    ): Boolean
}

/** Verifies with the bundled SPKI receipt key. Blank key (debug builds) ⇒ nothing verifies ⇒ never purge. */
class SpkiEd25519Verifier(spkiBase64: String) : Ed25519Verifier {
    private val publicKey =
        spkiBase64.takeIf { it.isNotBlank() }?.let {
            try {
                KeyFactory.getInstance("Ed25519").generatePublic(X509EncodedKeySpec(Base64.getDecoder().decode(it)))
            } catch (_: Exception) {
                null
            }
        }

    override fun verify(
        payload: ByteArray,
        signature: ByteArray,
    ): Boolean {
        val key = publicKey ?: return false
        return try {
            val v = Signature.getInstance("Ed25519")
            v.initVerify(key)
            v.update(payload)
            v.verify(signature)
        } catch (_: Exception) {
            false
        }
    }
}

class TombstoneVerifier(
    private val verifier: Ed25519Verifier,
) {
    fun isValid(
        t: DeliveryTombstone,
        nowMs: Long,
    ): Boolean {
        if (t.ackType != DeliveryTombstone.ACK_TYPE) return false
        if (!PACKET_HASH.matches(t.packetHash)) return false
        val tsMs =
            try {
                Instant.parse(t.timestamp).toEpochMilli()
            } catch (_: Exception) {
                return false
            }
        if (nowMs > tsMs + LIFETIME_MS || tsMs > nowMs + FUTURE_SKEW_MS) return false
        val sig =
            try {
                Base64.getDecoder().decode(t.signature)
            } catch (_: IllegalArgumentException) {
                return false
            }
        if (sig.size != 64) return false
        return verifier.verify(t.signedPayload().toByteArray(Charsets.UTF_8), sig)
    }

    companion object {
        const val LIFETIME_MS = 72L * 3_600_000L
        const val FUTURE_SKEW_MS = 300_000L
        private val PACKET_HASH = Regex("^[a-f0-9]{64}$")
    }
}

/** Verified tombstones; expire at timestamp + 72 h, cap 1024. */
class TombstoneStore(private val cap: Int = 1024) {
    private val byKey = LinkedHashMap<MessageKey, DeliveryTombstone>()
    private val lock = Any()

    fun put(t: DeliveryTombstone) =
        synchronized(lock) {
            byKey.remove(t.messageKey)
            byKey[t.messageKey] = t
            while (byKey.size > cap) byKey.remove(byKey.keys.first())
        }

    fun get(key: MessageKey): DeliveryTombstone? = synchronized(lock) { byKey[key] }

    fun all(): List<DeliveryTombstone> = synchronized(lock) { byKey.values.toList() }

    fun prune(nowMs: Long) =
        synchronized(lock) {
            byKey.entries.removeAll { e ->
                val ts =
                    try {
                        Instant.parse(e.value.timestamp).toEpochMilli()
                    } catch (_: Exception) {
                        0L
                    }
                nowMs > ts + TombstoneVerifier.LIFETIME_MS
            }
        }
}

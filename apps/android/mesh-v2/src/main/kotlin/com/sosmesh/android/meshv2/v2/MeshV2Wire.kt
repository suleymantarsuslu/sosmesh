package com.sosmesh.android.meshv2.v2

import java.security.MessageDigest

/** mesh-v2.md §1 identifiers and §4.2 / §5 byte layouts. Pure Kotlin, no Android types. */
object MeshV2Wire {
    const val MESH_INFO_CHAR_UUID: String = "0000FFF4-0000-1000-8000-00805F9B34FB"
    const val VERSION: Byte = 0x02
    const val H_OFFLINE: Int = 0xFF
    const val MAX_HOPS: Int = 8
    const val MESSAGE_KEY_BYTES: Int = 16
    const val MAX_KEYS_PER_FRAME: Int = 8

    const val TYPE_OFFER: Byte = 0x30
    const val TYPE_OFFER_REPLY: Byte = 0x31
    const val TYPE_TOMBSTONE_REQUEST: Byte = 0x32
    const val TYPE_TOMBSTONE: Byte = 0x34

    const val FLAG_RELAY_ON = 0x01
    const val FLAG_ACCEPTS_CARRY = 0x02
    const val FLAG_WATCH = 0x04
    const val FLAG_OWN_PENDING = 0x08

    /** iOS hops UUIDs 0xFFE0 + h. */
    const val IOS_HOPS_UUID_BASE: Int = 0xFFE0

    fun sha256(bytes: ByteArray): ByteArray = MessageDigest.getInstance("SHA-256").digest(bytes)

    fun messageKey(messageId: String): MessageKey = MessageKey(sha256(messageId.toByteArray(Charsets.UTF_8)).copyOf(MESSAGE_KEY_BYTES))

    fun hex(bytes: ByteArray): String = bytes.joinToString("") { "%02x".format(it.toInt() and 0xFF) }

    fun unhex(value: String): ByteArray {
        require(value.length % 2 == 0) { "odd hex" }
        return ByteArray(value.length / 2) { i -> value.substring(i * 2, i * 2 + 2).toInt(16).toByte() }
    }

    /** Ids in logs only as 8 hex of SHA-256 (invariant 5). */
    fun logId(value: String): String = hex(sha256(value.toByteArray(Charsets.UTF_8))).take(8)
}

class MessageKey(bytes: ByteArray) {
    val bytes: ByteArray = bytes.copyOf()

    init {
        require(bytes.size == MeshV2Wire.MESSAGE_KEY_BYTES) { "messageKey must be 16 bytes" }
    }

    val hex: String get() = MeshV2Wire.hex(bytes)

    override fun equals(other: Any?): Boolean = other is MessageKey && other.bytes.contentEquals(bytes)

    override fun hashCode(): Int = bytes.contentHashCode()

    override fun toString(): String = "MessageKey(${hex.take(8)})"
}

enum class OfferStatus(val code: Int) {
    WANT(0),
    HAVE(1),
    DELIVERED(2),
    FULL(3),
    REFUSED(4),
    ;

    companion object {
        fun fromCode(code: Int): OfferStatus? = entries.firstOrNull { it.code == code }
    }
}

sealed class MeshV2Frame {
    data class Offer(val keys: List<MessageKey>) : MeshV2Frame()

    data class OfferReply(val statuses: List<OfferStatus>) : MeshV2Frame()

    data class TombstoneRequest(val keys: List<MessageKey>) : MeshV2Frame()

    data class Tombstone(val tombstone: DeliveryTombstone) : MeshV2Frame()
}

object MeshV2FrameCodec {
    fun isV2ControlFrame(bytes: ByteArray): Boolean =
        bytes.isNotEmpty() && (bytes[0] == MeshV2Wire.TYPE_OFFER || bytes[0] == MeshV2Wire.TYPE_TOMBSTONE_REQUEST)

    fun isV2AckFrame(bytes: ByteArray): Boolean =
        bytes.isNotEmpty() && (bytes[0] == MeshV2Wire.TYPE_OFFER_REPLY || bytes[0] == MeshV2Wire.TYPE_TOMBSTONE)

    fun encodeOffer(keys: List<MessageKey>): ByteArray = encodeKeys(MeshV2Wire.TYPE_OFFER, keys)

    fun encodeTombstoneRequest(keys: List<MessageKey>): ByteArray = encodeKeys(MeshV2Wire.TYPE_TOMBSTONE_REQUEST, keys)

    fun encodeOfferReply(statuses: List<OfferStatus>): ByteArray {
        require(statuses.size in 1..MeshV2Wire.MAX_KEYS_PER_FRAME) { "1..8 statuses" }
        val out = ByteArray(2 + statuses.size)
        out[0] = MeshV2Wire.TYPE_OFFER_REPLY
        out[1] = statuses.size.toByte()
        statuses.forEachIndexed { i, s -> out[2 + i] = s.code.toByte() }
        return out
    }

    /** `[0x34][idLen][messageId][packetHash 32B][tsLen][timestamp][signature 64B][hopsLeft]`. */
    fun encodeTombstone(t: DeliveryTombstone): ByteArray {
        val id = t.messageId.toByteArray(Charsets.UTF_8)
        val ts = t.timestamp.toByteArray(Charsets.US_ASCII)
        val hash = MeshV2Wire.unhex(t.packetHash)
        val sig = java.util.Base64.getDecoder().decode(t.signature)
        require(id.size in 1..64 && ts.size <= 32 && hash.size == 32 && sig.size == 64) { "invalid tombstone fields" }
        val out = java.io.ByteArrayOutputStream()
        out.write(MeshV2Wire.TYPE_TOMBSTONE.toInt())
        out.write(id.size)
        out.write(id)
        out.write(hash)
        out.write(ts.size)
        out.write(ts)
        out.write(sig)
        out.write(t.hopsLeft.coerceIn(0, MeshV2Wire.MAX_HOPS))
        return out.toByteArray()
    }

    fun decode(bytes: ByteArray): MeshV2Frame? =
        try {
            when (bytes.firstOrNull()) {
                MeshV2Wire.TYPE_OFFER -> decodeKeys(bytes)?.let { MeshV2Frame.Offer(it) }
                MeshV2Wire.TYPE_TOMBSTONE_REQUEST -> decodeKeys(bytes)?.let { MeshV2Frame.TombstoneRequest(it) }
                MeshV2Wire.TYPE_OFFER_REPLY -> decodeOfferReply(bytes)
                MeshV2Wire.TYPE_TOMBSTONE -> decodeTombstone(bytes)
                else -> null
            }
        } catch (_: IndexOutOfBoundsException) {
            null
        } catch (_: IllegalArgumentException) {
            null
        }

    private fun encodeKeys(
        type: Byte,
        keys: List<MessageKey>,
    ): ByteArray {
        require(keys.size in 1..MeshV2Wire.MAX_KEYS_PER_FRAME) { "1..8 keys" }
        val out = ByteArray(2 + keys.size * MeshV2Wire.MESSAGE_KEY_BYTES)
        out[0] = type
        out[1] = keys.size.toByte()
        keys.forEachIndexed { i, k -> k.bytes.copyInto(out, 2 + i * MeshV2Wire.MESSAGE_KEY_BYTES) }
        return out
    }

    private fun decodeKeys(bytes: ByteArray): List<MessageKey>? {
        if (bytes.size < 2) return null
        val n = bytes[1].toInt() and 0xFF
        if (n !in 1..MeshV2Wire.MAX_KEYS_PER_FRAME || bytes.size != 2 + n * MeshV2Wire.MESSAGE_KEY_BYTES) return null
        return (0 until n).map { i ->
            val start = 2 + i * MeshV2Wire.MESSAGE_KEY_BYTES
            MessageKey(bytes.copyOfRange(start, start + MeshV2Wire.MESSAGE_KEY_BYTES))
        }
    }

    private fun decodeOfferReply(bytes: ByteArray): MeshV2Frame? {
        if (bytes.size < 2) return null
        val n = bytes[1].toInt() and 0xFF
        if (bytes.size != 2 + n) return null
        val statuses = (0 until n).map { OfferStatus.fromCode(bytes[2 + it].toInt() and 0xFF) ?: return null }
        return MeshV2Frame.OfferReply(statuses)
    }

    private fun decodeTombstone(bytes: ByteArray): MeshV2Frame? {
        var p = 1
        val idLen = bytes[p++].toInt() and 0xFF
        val id = String(bytes, p, idLen, Charsets.UTF_8)
        p += idLen
        val hash = MeshV2Wire.hex(bytes.copyOfRange(p, p + 32))
        p += 32
        val tsLen = bytes[p++].toInt() and 0xFF
        if (tsLen > 32) return null
        val ts = String(bytes, p, tsLen, Charsets.US_ASCII)
        p += tsLen
        val sig = java.util.Base64.getEncoder().encodeToString(bytes.copyOfRange(p, p + 64))
        p += 64
        val hops = bytes[p++].toInt() and 0xFF
        if (p != bytes.size || hash.length != 64) return null
        return MeshV2Frame.Tombstone(
            DeliveryTombstone(
                ackType = DeliveryTombstone.ACK_TYPE,
                messageId = id,
                packetHash = hash,
                timestamp = ts,
                signature = sig,
                hopsLeft = hops.coerceAtMost(MeshV2Wire.MAX_HOPS),
            ),
        )
    }
}

/** §5.3 MESH_INFO, 16 bytes. */
data class MeshInfo(
    val h: Int,
    val flags: Int,
    val carryFillPercent: Int,
    val secondsSinceConfirmed: Int,
    val selfKey: Int,
    val parentKey: Int,
) {
    fun encode(): ByteArray {
        val out = ByteArray(SIZE)
        out[0] = MeshV2Wire.VERSION
        out[1] = h.toByte()
        out[2] = flags.toByte()
        out[3] = carryFillPercent.coerceIn(0, 100).toByte()
        val secs = secondsSinceConfirmed.coerceIn(0, 0xFFFF)
        out[4] = (secs shr 8).toByte()
        out[5] = secs.toByte()
        putInt(out, 6, selfKey)
        putInt(out, 10, parentKey)
        return out
    }

    companion object {
        const val SIZE = 16

        fun decode(bytes: ByteArray): MeshInfo? {
            if (bytes.size < SIZE || bytes[0] != MeshV2Wire.VERSION) return null
            return MeshInfo(
                h = bytes[1].toInt() and 0xFF,
                flags = bytes[2].toInt() and 0xFF,
                carryFillPercent = bytes[3].toInt() and 0xFF,
                secondsSinceConfirmed = ((bytes[4].toInt() and 0xFF) shl 8) or (bytes[5].toInt() and 0xFF),
                selfKey = getInt(bytes, 6),
                parentKey = getInt(bytes, 10),
            )
        }

        /** selfKey = first 4 bytes of SHA-256(relayId ‖ day-number UTC). relayId hex decoded; day as u32 BE. */
        fun selfKey(
            relayIdHex: String,
            nowMs: Long,
        ): Int {
            val day = (nowMs / 86_400_000L).toInt()
            val dayBytes = ByteArray(4)
            putInt(dayBytes, 0, day)
            val digest = MeshV2Wire.sha256(MeshV2Wire.unhex(relayIdHex) + dayBytes)
            return getInt(digest, 0)
        }

        private fun putInt(
            out: ByteArray,
            offset: Int,
            v: Int,
        ) {
            out[offset] = (v ushr 24).toByte()
            out[offset + 1] = (v ushr 16).toByte()
            out[offset + 2] = (v ushr 8).toByte()
            out[offset + 3] = v.toByte()
        }

        private fun getInt(
            b: ByteArray,
            o: Int,
        ): Int =
            ((b[o].toInt() and 0xFF) shl 24) or ((b[o + 1].toInt() and 0xFF) shl 16) or
                ((b[o + 2].toInt() and 0xFF) shl 8) or (b[o + 3].toInt() and 0xFF)
    }
}

/** §4.2 advertisement encodings. */
object MeshV2Advertisement {
    fun androidServiceData(
        h: Int,
        flags: Int,
    ): ByteArray = byteArrayOf(MeshV2Wire.VERSION, h.toByte(), flags.toByte())

    data class Parsed(val h: Int, val flags: Int)

    fun parseAndroidServiceData(data: ByteArray?): Parsed? {
        if (data == null || data.size < 3 || data[0] != MeshV2Wire.VERSION) return null
        val h = data[1].toInt() and 0xFF
        if (h != MeshV2Wire.H_OFFLINE && h > MeshV2Wire.MAX_HOPS) return null
        return Parsed(h, data[2].toInt() and 0xFF)
    }

    /** iOS hops UUID 0xFFE0..0xFFE8 ⇒ h; none ⇒ offline. */
    fun parseIosHopsUuids(shortUuids: Collection<Int>): Int =
        shortUuids.filter { it in MeshV2Wire.IOS_HOPS_UUID_BASE..MeshV2Wire.IOS_HOPS_UUID_BASE + MeshV2Wire.MAX_HOPS }
            .minOfOrNull { it - MeshV2Wire.IOS_HOPS_UUID_BASE } ?: MeshV2Wire.H_OFFLINE
}

package com.sosmesh.android.core.protocol

object BleProtocolTypes {
    const val PROTOCOL_VERSION: Int = 0x01
    const val CHUNK_HEADER_SIZE: Int = 12
    const val ATT_OVERHEAD: Int = 3
    const val DEFAULT_MTU: Int = 247

    const val HELLO_TIMEOUT_MS: Long = 5_000L
}

enum class MessageType(val wire: Int) {
    HELLO(0x01),
    HELLO_ACK(0x02),
    ACK(0x10),
    NACK(0x11),
    RESUME_REQUEST(0x20),
    TRANSFER_VERIFIED(0x21),
    ;

    companion object {
        fun fromWire(value: Int): MessageType? = entries.firstOrNull { it.wire == value }
    }
}

enum class ChunkFlags(val bit: Int) {
    FIRST_CHUNK(0x01),
    LAST_CHUNK(0x02),
    ;

    fun has(flags: Int): Boolean = flags and bit != 0
}

enum class ErrorCode(val wire: Int) {
    CRC_MISMATCH(0x01),
    SEQUENCE_ERROR(0x02),
    TIMEOUT(0x03),
    BUFFER_FULL(0x04),
    VERSION_MISMATCH(0x10),
    DIGEST_INVALID(0x11),
    TOTAL_MISMATCH(0x12),
    GENERIC_TIMEOUT(0x20),
}

enum class TransferState {
    IDLE,
    HELLO_SENT,
    READY,
    SENDING,
    WAIT_ACK,
    RETRY_CHUNK,
    VERIFYING,
    COMPLETED,
    FAILED,
    RESUMING,
    WAIT_PEER_VERIFIED,
}

data class TransferConfig(
    val mtu: Int = BleProtocolTypes.DEFAULT_MTU,
    val windowSize: Int = 4,
    val chunkTimeoutMs: Long = 2_000L,
    val maxRetries: Int = 3,
    val retryJitterMs: Long = 500L,
    val peerVerifyTimeoutMs: Long = 5_000L,
)

data class ChunkHeader(
    val seq: Int,
    val total: Int,
    val crc32: Long,
    val flags: Int,
)

data class Chunk(
    val header: ChunkHeader,
    val payload: ByteArray,
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is Chunk) return false
        return header == other.header && payload.contentEquals(other.payload)
    }

    override fun hashCode(): Int {
        var result = header.hashCode()
        result = 31 * result + payload.contentHashCode()
        return result
    }
}

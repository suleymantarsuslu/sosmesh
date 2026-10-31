package com.sosmesh.android.core.protocol

/** Wire: type(1) + transfer_id(16) + sha256_digest(32) = 49 bytes on ACK characteristic. */
object BleTransferVerifiedMessage {
    const val WIRE_SIZE: Int = 49

    fun encode(
        transferId: ByteArray,
        digest: ByteArray,
    ): ByteArray {
        require(transferId.size >= 16) { "transferId must be 16 bytes" }
        require(digest.size == 32) { "digest must be 32 bytes" }
        val buffer = ByteArray(WIRE_SIZE)
        buffer[0] = MessageType.TRANSFER_VERIFIED.wire.toByte()
        transferId.copyInto(buffer, 1, 0, 16)
        digest.copyInto(buffer, 17, 0, 32)
        return buffer
    }

    fun decode(data: ByteArray): Pair<ByteArray, ByteArray>? {
        if (data.size < WIRE_SIZE) return null
        if ((data[0].toInt() and 0xff) != MessageType.TRANSFER_VERIFIED.wire) return null
        val transferId = data.copyOfRange(1, 17)
        val digest = data.copyOfRange(17, 49)
        return transferId to digest
    }
}

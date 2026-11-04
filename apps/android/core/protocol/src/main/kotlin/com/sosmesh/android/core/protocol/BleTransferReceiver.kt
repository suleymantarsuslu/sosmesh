package com.sosmesh.android.core.protocol

class BleTransferReceiver(
    private val transport: BleTransferTransport,
    private val config: TransferConfig = TransferConfig(),
    private val clock: BleTransferClock = SystemBleTransferClock(),
) {
    interface Listener {
        fun onCompleted(payload: ByteArray)

        fun onFailed(
            code: ErrorCode,
            message: String,
        )
    }

    private var listener: Listener? = null
    private var state: TransferState = TransferState.IDLE
    private val chunks = linkedMapOf<Int, Chunk>()
    private var expectedTotal = 0
    private var receivedDigest: ByteArray? = null
    private var negotiatedMtu = 0
    private var currentTransferId: ByteArray? = null

    init {
        transport.setIncomingHandler { handleData(it) }
    }

    fun setListener(listener: Listener?) {
        this.listener = listener
    }

    fun getState(): TransferState = state

    fun getReceivedChunkSeqs(): List<Int> = chunks.keys.sorted()

    fun requestResume() {
        val transferId = currentTransferId ?: return
        val canResume =
            state == TransferState.RESUMING ||
                (state == TransferState.READY && expectedTotal > 0 && chunks.size < expectedTotal)
        if (!canResume) return
        val receivedSeqs = chunks.keys.sorted()
        val buffer = ByteArray(1 + 2 + 16 + receivedSeqs.size * 2)
        buffer[0] = MessageType.RESUME_REQUEST.wire.toByte()
        buffer[1] = ((receivedSeqs.size shr 8) and 0xff).toByte()
        buffer[2] = (receivedSeqs.size and 0xff).toByte()
        transferId.copyInto(buffer, 3, 0, minOf(16, transferId.size))
        var offset = 19
        receivedSeqs.forEach { seq ->
            buffer[offset] = ((seq shr 8) and 0xff).toByte()
            buffer[offset + 1] = (seq and 0xff).toByte()
            offset += 2
        }
        transport.send(buffer)
        state = TransferState.READY
    }

    private fun handleData(data: ByteArray) {
        if (data.isEmpty()) return
        val msgType = data[0].toInt() and 0xff
        if (msgType == MessageType.HELLO.wire) {
            if (state == TransferState.IDLE || state == TransferState.COMPLETED || state == TransferState.FAILED) {
                if (state != TransferState.IDLE) {
                    resetState()
                }
                handleHello(data)
            }
        } else if (
            msgType != MessageType.TRANSFER_VERIFIED.wire &&
            msgType != MessageType.HELLO.wire &&
            msgType != MessageType.HELLO_ACK.wire &&
            msgType != MessageType.ACK.wire &&
            msgType != MessageType.NACK.wire &&
            msgType != MessageType.RESUME_REQUEST.wire &&
            data.size >= BleProtocolTypes.CHUNK_HEADER_SIZE
        ) {
            handleChunk(data)
        }
    }

    private fun handleHello(data: ByteArray) {
        if (data.size < 20) {
            sendHelloAck(0, 0, ByteArray(16), ErrorCode.GENERIC_TIMEOUT.wire)
            return
        }
        val version = data[1].toInt() and 0xff
        val nonce = data.copyOfRange(2, 18)
        val mtu = ((data[18].toInt() and 0xff) shl 8) or (data[19].toInt() and 0xff)
        currentTransferId = nonce
        if (version != BleProtocolTypes.PROTOCOL_VERSION) {
            sendHelloAck(version, 0, nonce, ErrorCode.VERSION_MISMATCH.wire)
            return
        }
        negotiatedMtu = minOf(config.mtu, mtu)
        sendHelloAck(BleProtocolTypes.PROTOCOL_VERSION, negotiatedMtu, nonce, 0)
        state = TransferState.READY
    }

    private fun sendHelloAck(
        version: Int,
        mtu: Int,
        nonceEcho: ByteArray,
        status: Int,
    ) {
        val buffer = ByteArray(21)
        buffer[0] = MessageType.HELLO_ACK.wire.toByte()
        buffer[1] = version.toByte()
        nonceEcho.copyInto(buffer, 2, 0, minOf(16, nonceEcho.size))
        buffer[18] = ((mtu shr 8) and 0xff).toByte()
        buffer[19] = (mtu and 0xff).toByte()
        buffer[20] = status.toByte()
        transport.send(buffer)
    }

    private fun handleChunk(data: ByteArray) {
        if (state != TransferState.READY && state != TransferState.VERIFYING) return
        val chunk = BleChunkCodec.deserializeChunk(data) ?: return
        val crc = BleChunkCodec.calculateCrc32(chunk.payload)
        if (chunk.header.crc32 != crc) {
            sendNack(chunk.header.seq, ErrorCode.CRC_MISMATCH)
            return
        }
        if (expectedTotal == 0) {
            expectedTotal = chunk.header.total
        } else if (chunk.header.total != expectedTotal) {
            sendNack(chunk.header.seq, ErrorCode.TOTAL_MISMATCH)
            fail(ErrorCode.TOTAL_MISMATCH, "Total mismatch")
            return
        }
        if (chunks.containsKey(chunk.header.seq)) {
            sendAck(chunk.header.seq)
            return
        }
        chunks[chunk.header.seq] = chunk
        sendAck(chunk.header.seq)
        if (chunks.size == expectedTotal) {
            verifyAndComplete()
        }
    }

    private fun verifyAndComplete() {
        state = TransferState.VERIFYING
        try {
            val ordered = (0 until expectedTotal).map { requireNotNull(chunks[it]) { "Missing chunk $it" } }
            val lastChunk = ordered.last()
            val extracted = BleChunkCodec.extractDigestFromLastChunk(lastChunk)
            if (extracted == null) {
                sendDigestInvalidNack()
                fail(ErrorCode.DIGEST_INVALID, "Failed to extract digest")
                return
            }
            val (digest, lastData) = extracted
            receivedDigest = digest
            val modified = ordered.toMutableList()
            modified[modified.lastIndex] = Chunk(lastChunk.header, lastData)
            val assembled = BleChunkCodec.assembleChunks(modified)
            if (!BleChunkCodec.verifyDigest(assembled, digest)) {
                sendDigestInvalidNack()
                fail(ErrorCode.DIGEST_INVALID, "Digest verification failed")
                return
            }
            val transferId = currentTransferId ?: ByteArray(16)
            transport.send(BleTransferVerifiedMessage.encode(transferId, digest))
            state = TransferState.COMPLETED
            listener?.onCompleted(assembled)
        } catch (ex: IllegalStateException) {
            sendDigestInvalidNack()
            fail(ErrorCode.DIGEST_INVALID, ex.message ?: "Verification failed")
        }
    }

    private fun sendDigestInvalidNack() {
        if (expectedTotal <= 0) return
        sendNack(expectedTotal - 1, ErrorCode.DIGEST_INVALID)
    }

    private fun sendAck(seq: Int) {
        val buffer = ByteArray(4)
        buffer[0] = MessageType.ACK.wire.toByte()
        buffer[1] = ((seq shr 8) and 0xff).toByte()
        buffer[2] = (seq and 0xff).toByte()
        buffer[3] = 0
        transport.send(buffer)
    }

    private fun sendNack(
        seq: Int,
        reason: ErrorCode,
    ) {
        val buffer = ByteArray(4)
        buffer[0] = MessageType.NACK.wire.toByte()
        buffer[1] = ((seq shr 8) and 0xff).toByte()
        buffer[2] = (seq and 0xff).toByte()
        buffer[3] = reason.wire.toByte()
        transport.send(buffer)
    }

    private fun fail(
        code: ErrorCode,
        message: String,
    ) {
        state = TransferState.FAILED
        listener?.onFailed(code, message)
    }

    private fun resetState() {
        chunks.clear()
        expectedTotal = 0
        receivedDigest = null
        negotiatedMtu = 0
        currentTransferId = null
        state = TransferState.IDLE
    }

    fun onTransportDisconnected() {
        if (state == TransferState.COMPLETED || state == TransferState.FAILED) {
            resetState()
            return
        }
        if (chunks.isNotEmpty() && expectedTotal > 0) {
            state = TransferState.RESUMING
        } else {
            fail(ErrorCode.GENERIC_TIMEOUT, "Transport disconnected")
        }
    }

    fun close() {
        transport.close()
    }
}

package com.sosmesh.android.core.protocol

class BleTransferSender(
    private val transport: BleTransferTransport,
    private val config: TransferConfig = TransferConfig(),
    private val clock: BleTransferClock = SystemBleTransferClock(),
    private val rng: BleTransferRng = SystemBleTransferRng(),
) {
    interface Listener {
        /** All chunk ACKs received — safe to mark PEER_RECEIVED on device A. */
        fun onCompleted()

        fun onFailed(
            code: ErrorCode,
            message: String,
        )
    }

    private var listener: Listener? = null
    private var state: TransferState = TransferState.IDLE
    private var chunks: List<Chunk> = emptyList()
    private var currentSeq = 0
    private val inFlight = mutableSetOf<Int>()
    private val retryCount = mutableMapOf<Int, Int>()
    private val ackReceived = mutableSetOf<Int>()
    private var nonce: ByteArray? = null
    private var negotiatedMtu = 0
    private var chunkTimer: BleTransferTimer? = null
    private var originalPayload: ByteArray? = null
    private var expectedDigest: ByteArray? = null

    init {
        transport.setIncomingHandler { handleData(it) }
    }

    fun setListener(listener: Listener?) {
        this.listener = listener
    }

    fun getState(): TransferState = state

    fun startTransfer(payload: ByteArray) {
        check(state == TransferState.IDLE) { "Cannot start transfer in state $state" }
        originalPayload = payload
        expectedDigest = BleChunkCodec.calculateDigest(payload)
        nonce = ByteArray(16) { (rng.nextUnit() * 256).toInt().toByte() }
        state = TransferState.HELLO_SENT
        sendHello()
        chunkTimer =
            clock.schedule(BleProtocolTypes.HELLO_TIMEOUT_MS) {
                if (state == TransferState.HELLO_SENT) {
                    fail(ErrorCode.TIMEOUT, "HELLO_ACK timeout")
                }
            }
    }

    private fun sendHello() {
        val helloNonce = nonce ?: return
        val buffer = ByteArray(20)
        buffer[0] = MessageType.HELLO.wire.toByte()
        buffer[1] = BleProtocolTypes.PROTOCOL_VERSION.toByte()
        helloNonce.copyInto(buffer, 2)
        buffer[18] = ((config.mtu shr 8) and 0xff).toByte()
        buffer[19] = (config.mtu and 0xff).toByte()
        transport.send(buffer)
    }

    private fun handleData(data: ByteArray) {
        if (data.isEmpty()) return
        val msgType = data[0].toInt() and 0xff
        when {
            msgType == MessageType.HELLO_ACK.wire && state == TransferState.HELLO_SENT -> handleHelloAck(data)
            msgType == MessageType.ACK.wire &&
                (
                    state == TransferState.WAIT_ACK ||
                        state == TransferState.SENDING ||
                        state == TransferState.READY
                ) -> handleAck(data)
            msgType == MessageType.NACK.wire &&
                (state == TransferState.WAIT_ACK || state == TransferState.SENDING) -> handleNack(data)
            msgType == MessageType.RESUME_REQUEST.wire && chunks.isNotEmpty() -> handleResumeRequest(data)
        }
    }

    private fun handleHelloAck(data: ByteArray) {
        if (data.size < 21) return
        val version = data[1].toInt() and 0xff
        val nonceEcho = data.copyOfRange(2, 18)
        val mtu = ((data[18].toInt() and 0xff) shl 8) or (data[19].toInt() and 0xff)
        val status = data[20].toInt() and 0xff
        if (version != BleProtocolTypes.PROTOCOL_VERSION) {
            fail(ErrorCode.VERSION_MISMATCH, "Version mismatch")
            return
        }
        if (nonce == null || !nonceEcho.contentEquals(nonce)) {
            fail(ErrorCode.GENERIC_TIMEOUT, "Nonce mismatch")
            return
        }
        if (status != 0) {
            fail(ErrorCode.GENERIC_TIMEOUT, "HELLO_ACK rejected")
            return
        }
        clock.cancel(chunkTimer)
        chunkTimer = null
        negotiatedMtu = minOf(config.mtu, mtu)
        val chunkSize = negotiatedMtu - BleProtocolTypes.ATT_OVERHEAD - BleProtocolTypes.CHUNK_HEADER_SIZE
        val payload = originalPayload ?: return
        val normal = BleChunkCodec.splitIntoChunks(payload, chunkSize)
        val lastSeq = normal.lastIndex
        chunks =
            normal.dropLast(1) +
            BleChunkCodec.createLastChunkWithDigest(payload, chunkSize, lastSeq, normal.size)
        currentSeq = 0
        ackReceived.clear()
        inFlight.clear()
        retryCount.clear()
        state = TransferState.READY
        sendNextChunks()
    }

    private fun sendNextChunks() {
        if (state != TransferState.READY && state != TransferState.SENDING) return
        state = TransferState.SENDING
        while (inFlight.size < config.windowSize && currentSeq < chunks.size) {
            val seq = currentSeq
            if (!ackReceived.contains(seq) && !inFlight.contains(seq)) {
                sendChunk(seq)
            }
            currentSeq++
        }
        if (inFlight.isNotEmpty()) {
            state = TransferState.WAIT_ACK
            setChunkTimeout()
        } else if (ackReceived.size == chunks.size) {
            complete()
        } else {
            state = TransferState.WAIT_ACK
            setChunkTimeout()
        }
    }

    private fun sendChunk(seq: Int) {
        val serialized = BleChunkCodec.serializeChunk(chunks[seq])
        inFlight.add(seq)
        transport.send(serialized)
    }

    private fun setChunkTimeout() {
        clock.cancel(chunkTimer)
        val jitter = (rng.nextUnit() * config.retryJitterMs).toLong()
        chunkTimer =
            clock.schedule(config.chunkTimeoutMs + jitter) {
                handleChunkTimeout()
            }
    }

    private fun handleChunkTimeout() {
        if (inFlight.isEmpty()) {
            if (state != TransferState.WAIT_ACK) return
            if (ackReceived.size == chunks.size) {
                complete()
                return
            }
            state = TransferState.READY
            currentSeq = 0
            sendNextChunks()
            return
        }
        if (state != TransferState.WAIT_ACK && state != TransferState.SENDING) return
        val toRetry = inFlight.toList()
        for (seq in toRetry) {
            val retries = retryCount.getOrDefault(seq, 0)
            if (retries >= config.maxRetries) {
                fail(ErrorCode.TIMEOUT, "Max retries exceeded for chunk $seq")
                return
            }
            retryCount[seq] = retries + 1
        }
        inFlight.clear()
        state = TransferState.READY
        currentSeq = 0
        sendNextChunks()
    }

    private fun handleAck(data: ByteArray) {
        if (data.size < 4) return
        val seq = ((data[1].toInt() and 0xff) shl 8) or (data[2].toInt() and 0xff)
        val status = data[3].toInt() and 0xff
        if (status != 0) return
        ackReceived.add(seq)
        inFlight.remove(seq)
        clock.cancel(chunkTimer)
        chunkTimer = null
        if (ackReceived.size == chunks.size) {
            complete()
        } else {
            state = TransferState.READY
            sendNextChunks()
        }
    }

    private fun handleNack(data: ByteArray) {
        if (data.size < 4) return
        val seq = ((data[1].toInt() and 0xff) shl 8) or (data[2].toInt() and 0xff)
        inFlight.remove(seq)
        val retries = retryCount.getOrDefault(seq, 0)
        if (retries >= config.maxRetries) {
            fail(ErrorCode.TIMEOUT, "Max retries exceeded for chunk $seq after NACK")
            return
        }
        retryCount[seq] = retries + 1
        clock.cancel(chunkTimer)
        chunkTimer = null
        state = TransferState.READY
        sendNextChunks()
    }

    private fun handleResumeRequest(data: ByteArray) {
        if (data.size < 19) return
        val receivedCount = ((data[1].toInt() and 0xff) shl 8) or (data[2].toInt() and 0xff)
        val transferId = data.copyOfRange(3, 19)
        if (nonce == null || !transferId.contentEquals(nonce)) return
        val receivedSeqs = mutableSetOf<Int>()
        var offset = 19
        repeat(receivedCount) {
            if (offset + 1 >= data.size) return
            val seq = ((data[offset].toInt() and 0xff) shl 8) or (data[offset + 1].toInt() and 0xff)
            receivedSeqs.add(seq)
            offset += 2
        }
        ackReceived.clear()
        ackReceived.addAll(receivedSeqs)
        inFlight.clear()
        currentSeq = 0
        retryCount.clear()
        clock.cancel(chunkTimer)
        chunkTimer = null
        state = TransferState.READY
        sendNextChunks()
    }

    private fun complete() {
        state = TransferState.COMPLETED
        clock.cancel(chunkTimer)
        chunkTimer = null
        listener?.onCompleted()
    }

    private fun fail(
        code: ErrorCode,
        message: String,
    ) {
        state = TransferState.FAILED
        clock.cancel(chunkTimer)
        chunkTimer = null
        listener?.onFailed(code, message)
    }

    fun onTransportDisconnected() {
        if (state == TransferState.COMPLETED || state == TransferState.FAILED) return
        if (chunks.isNotEmpty()) {
            state = TransferState.RESUMING
            clock.cancel(chunkTimer)
            chunkTimer = null
        } else {
            fail(ErrorCode.GENERIC_TIMEOUT, "Transport disconnected")
        }
    }

    fun close() {
        clock.cancel(chunkTimer)
        transport.close()
    }
}

import Foundation

public final class BleTransferSender {
    public protocol Listener: AnyObject {
        func onCompleted()
        func onFailed(code: BleTransferErrorCode, message: String)
    }

    private let transport: BleTransferTransport
    private var config: BleTransferConfig
    private let clock: BleTransferClock
    private let rng: BleTransferRng

    private weak var listener: Listener?
    private var state: BleTransferState = .idle
    private var chunks: [BleTransferChunk] = []
    private var currentSeq = 0
    private var inFlight = Set<Int>()
    private var retryCount: [Int: Int] = [:]
    private var ackReceived = Set<Int>()
    private var nonce: Data?
    private var negotiatedMtu = 0
    private var chunkTimer: BleTransferTimer?
    private var verifyTimer: BleTransferTimer?
    private var originalPayload: Data?
    private var expectedDigest: Data?
    private var peerVerifyAttempts = 0

    public init(
        transport: BleTransferTransport,
        config: BleTransferConfig = BleTransferConfig(),
        clock: BleTransferClock = SystemBleTransferClock(),
        rng: BleTransferRng = SystemBleTransferRng()
    ) {
        self.transport = transport
        self.config = config
        self.clock = clock
        self.rng = rng
        transport.setIncomingHandler { [weak self] in self?.handleData($0) }
    }

    public func setListener(_ listener: Listener?) {
        self.listener = listener
    }

    public func getState() -> BleTransferState { state }

    /// A transfer is in flight (not idle and not finished).
    public var isBusy: Bool {
        switch state {
        case .idle, .completed, .failed: return false
        default: return true
        }
    }

    /// Applies the ATT MTU derived from the real link (`maximumWriteValueLength + 3`).
    /// Ignored while a transfer is running because HELLO already advertised the old value.
    public func setMtu(_ mtu: Int) {
        guard !isBusy else { return }
        config.mtu = mtu
    }

    /// Fails an in-flight transfer (listener sees `onFailed`), e.g. when the link drops.
    public func abort(_ message: String) {
        guard isBusy else { return }
        fail(.genericTimeout, message)
    }

    /// Returns a finished (completed/failed) sender to `.idle` so the next transfer can start.
    public func resetToIdle() {
        guard !isBusy else { return }
        clock.cancel(chunkTimer)
        chunkTimer = nil
        clock.cancel(verifyTimer)
        verifyTimer = nil
        chunks = []
        currentSeq = 0
        inFlight.removeAll()
        retryCount.removeAll()
        ackReceived.removeAll()
        nonce = nil
        originalPayload = nil
        expectedDigest = nil
        negotiatedMtu = 0
        peerVerifyAttempts = 0
        state = .idle
    }

    public func startTransfer(_ payload: Data) {
        precondition(state == .idle, "Cannot start transfer in state \(state)")
        originalPayload = payload
        expectedDigest = BleChunkCodec.calculateDigest(payload)
        var helloNonce = Data(count: 16)
        for index in 0 ..< 16 {
            helloNonce[index] = UInt8((rng.nextUnit() * 256).rounded(.down))
        }
        nonce = helloNonce
        peerVerifyAttempts = 0
        state = .helloSent
        sendHello()
        chunkTimer = clock.schedule(afterMs: BleTransferProtocolConstants.helloTimeoutMs) { [weak self] in
            guard let self, self.state == .helloSent else { return }
            self.fail(.timeout, "HELLO_ACK timeout")
        }
    }

    private func sendHello() {
        guard let helloNonce = nonce else { return }
        var buffer = Data(count: 20)
        buffer[0] = BleTransferMessageType.hello.rawValue
        buffer[1] = UInt8(BleTransferProtocolConstants.protocolVersion)
        buffer.replaceSubrange(2 ..< 18, with: helloNonce.prefix(16))
        buffer[18] = UInt8((config.mtu >> 8) & 0xff)
        buffer[19] = UInt8(config.mtu & 0xff)
        transport.send(buffer)
    }

    private func handleData(_ data: Data) {
        guard !data.isEmpty else { return }
        let msgType = Int(data[0])
        switch msgType {
        case Int(BleTransferMessageType.helloAck.rawValue) where state == .helloSent:
            handleHelloAck(data)
        case Int(BleTransferMessageType.transferVerified.rawValue) where state == .waitPeerVerified:
            handleTransferVerified(data)
        case Int(BleTransferMessageType.ack.rawValue)
            where state == .waitAck || state == .sending || state == .ready:
            handleAck(data)
        case Int(BleTransferMessageType.nack.rawValue)
            where state == .waitAck || state == .sending || state == .waitPeerVerified:
            handleNack(data)
        case Int(BleTransferMessageType.resumeRequest.rawValue) where !chunks.isEmpty:
            handleResumeRequest(data)
        default:
            break
        }
    }

    private func handleTransferVerified(_ data: Data) {
        guard let parsed = BleTransferVerifiedMessage.decode(data) else { return }
        let (transferId, digest) = parsed
        guard let helloNonce = nonce, let expected = expectedDigest else { return }
        guard transferId == helloNonce.prefix(16) else {
            fail(.genericTimeout, "Verified transfer ID mismatch")
            return
        }
        guard digest == expected else {
            fail(.digestInvalid, "Verified digest mismatch")
            return
        }
        clock.cancel(verifyTimer)
        verifyTimer = nil
        complete()
    }

    private func handleHelloAck(_ data: Data) {
        guard data.count >= 21 else { return }
        let version = Int(data[1])
        let nonceEcho = data.subdata(in: 2 ..< 18)
        let mtu = (Int(data[18]) << 8) | Int(data[19])
        let status = Int(data[20])
        if version != BleTransferProtocolConstants.protocolVersion {
            fail(.versionMismatch, "Version mismatch")
            return
        }
        guard let expectedNonce = nonce, nonceEcho == expectedNonce else {
            fail(.genericTimeout, "Nonce mismatch")
            return
        }
        if status != 0 {
            fail(.genericTimeout, "HELLO_ACK rejected")
            return
        }
        clock.cancel(chunkTimer)
        chunkTimer = nil
        negotiatedMtu = min(config.mtu, mtu)
        let chunkSize =
            negotiatedMtu - BleTransferProtocolConstants.attOverhead - BleTransferProtocolConstants.chunkHeaderSize
        guard let payload = originalPayload else { return }
        var dataChunkSize = chunkSize
        var normal = BleChunkCodec.splitIntoChunks(payload, chunkSize: dataChunkSize)
        if normal.count == 1, payload.count + 32 > chunkSize {
            dataChunkSize = chunkSize - 32
            normal = BleChunkCodec.splitIntoChunks(payload, chunkSize: dataChunkSize)
        }
        let lastSeq = normal.count - 1
        let lastChunk = BleChunkCodec.createLastChunkWithDigest(
            fullPayload: payload,
            chunkSize: dataChunkSize,
            seq: lastSeq,
            total: normal.count
        )
        chunks = Array(normal.dropLast()) + [lastChunk]
        currentSeq = 0
        ackReceived.removeAll()
        inFlight.removeAll()
        retryCount.removeAll()
        state = .ready
        sendNextChunks()
    }

    private func sendNextChunks() {
        guard state == .ready || state == .sending else { return }
        state = .sending
        while inFlight.count < config.windowSize, currentSeq < chunks.count {
            let seq = currentSeq
            if !ackReceived.contains(seq), !inFlight.contains(seq) {
                sendChunk(seq)
            }
            currentSeq += 1
        }
        if !inFlight.isEmpty {
            state = .waitAck
            setChunkTimeout()
        } else if ackReceived.count == chunks.count {
            beginWaitPeerVerified()
        } else {
            state = .waitAck
            setChunkTimeout()
        }
    }

    private func sendChunk(_ seq: Int) {
        let serialized = BleChunkCodec.serializeChunk(chunks[seq])
        inFlight.insert(seq)
        transport.send(serialized)
    }

    private func setChunkTimeout() {
        clock.cancel(chunkTimer)
        let jitter = Int64((rng.nextUnit() * Double(config.retryJitterMs)).rounded(.down))
        chunkTimer = clock.schedule(afterMs: config.chunkTimeoutMs + jitter) { [weak self] in
            self?.handleChunkTimeout()
        }
    }

    private func setPeerVerifyTimeout() {
        clock.cancel(verifyTimer)
        let jitter = Int64((rng.nextUnit() * Double(config.retryJitterMs)).rounded(.down))
        verifyTimer = clock.schedule(afterMs: config.peerVerifyTimeoutMs + jitter) { [weak self] in
            self?.handlePeerVerifyTimeout()
        }
    }

    private func handlePeerVerifyTimeout() {
        guard state == .waitPeerVerified else { return }
        peerVerifyAttempts += 1
        if peerVerifyAttempts >= config.maxRetries {
            fail(.timeout, "Peer verified message timeout")
            return
        }
        setPeerVerifyTimeout()
    }

    private func beginWaitPeerVerified() {
        state = .waitPeerVerified
        clock.cancel(chunkTimer)
        chunkTimer = nil
        inFlight.removeAll()
        setPeerVerifyTimeout()
    }

    private func handleChunkTimeout() {
        if state == .waitPeerVerified {
            handlePeerVerifyTimeout()
            return
        }
        if inFlight.isEmpty {
            guard state == .waitAck else { return }
            if ackReceived.count == chunks.count {
                beginWaitPeerVerified()
                return
            }
            state = .ready
            currentSeq = 0
            sendNextChunks()
            return
        }
        guard state == .waitAck || state == .sending else { return }
        let toRetry = Array(inFlight)
        for seq in toRetry {
            let retries = retryCount[seq, default: 0]
            if retries >= config.maxRetries {
                fail(.timeout, "Max retries exceeded for chunk \(seq)")
                return
            }
            retryCount[seq] = retries + 1
        }
        inFlight.removeAll()
        state = .ready
        currentSeq = 0
        sendNextChunks()
    }

    private func handleAck(_ data: Data) {
        guard data.count >= 4 else { return }
        let seq = (Int(data[1]) << 8) | Int(data[2])
        let status = Int(data[3])
        guard status == 0 else { return }
        ackReceived.insert(seq)
        inFlight.remove(seq)
        clock.cancel(chunkTimer)
        chunkTimer = nil
        if ackReceived.count == chunks.count {
            beginWaitPeerVerified()
        } else {
            state = .ready
            sendNextChunks()
        }
    }

    private func handleNack(_ data: Data) {
        guard data.count >= 4 else { return }
        let seq = (Int(data[1]) << 8) | Int(data[2])
        let reason = Int(data[3])
        if reason == BleTransferErrorCode.digestInvalid.rawValue {
            fail(.digestInvalid, "Peer rejected digest at seq \(seq)")
            return
        }
        if state == .waitPeerVerified {
            fail(.digestInvalid, "Unexpected NACK while waiting for verified message")
            return
        }
        inFlight.remove(seq)
        let retries = retryCount[seq, default: 0]
        if retries >= config.maxRetries {
            fail(.timeout, "Max retries exceeded for chunk \(seq) after NACK")
            return
        }
        retryCount[seq] = retries + 1
        clock.cancel(chunkTimer)
        chunkTimer = nil
        state = .ready
        sendNextChunks()
    }

    private func handleResumeRequest(_ data: Data) {
        guard data.count >= 19 else { return }
        let receivedCount = (Int(data[1]) << 8) | Int(data[2])
        let transferId = data.subdata(in: 3 ..< 19)
        guard let expectedNonce = nonce, transferId == expectedNonce.prefix(16) else { return }
        var receivedSeqs = Set<Int>()
        var offset = 19
        for _ in 0 ..< receivedCount {
            guard offset + 1 < data.count else { return }
            let seq = (Int(data[offset]) << 8) | Int(data[offset + 1])
            receivedSeqs.insert(seq)
            offset += 2
        }
        ackReceived = receivedSeqs
        inFlight.removeAll()
        currentSeq = 0
        retryCount.removeAll()
        clock.cancel(chunkTimer)
        chunkTimer = nil
        clock.cancel(verifyTimer)
        verifyTimer = nil
        state = .ready
        sendNextChunks()
    }

    private func complete() {
        state = .completed
        clock.cancel(chunkTimer)
        chunkTimer = nil
        clock.cancel(verifyTimer)
        verifyTimer = nil
        listener?.onCompleted()
    }

    private func fail(_ code: BleTransferErrorCode, _ message: String) {
        state = .failed
        clock.cancel(chunkTimer)
        chunkTimer = nil
        clock.cancel(verifyTimer)
        verifyTimer = nil
        listener?.onFailed(code: code, message: message)
    }

    public func onTransportDisconnected() {
        if state == .completed || state == .failed { return }
        if !chunks.isEmpty {
            state = .resuming
            clock.cancel(chunkTimer)
            chunkTimer = nil
            clock.cancel(verifyTimer)
            verifyTimer = nil
        } else {
            fail(.genericTimeout, "Transport disconnected")
        }
    }

    public func close() {
        clock.cancel(chunkTimer)
        clock.cancel(verifyTimer)
        transport.close()
    }
}

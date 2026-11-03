import Foundation

public final class BleTransferReceiver {
    public protocol Listener: AnyObject {
        func onCompleted(payload: Data)
        func onFailed(code: BleTransferErrorCode, message: String)
    }

    private let transport: BleTransferTransport
    private let config: BleTransferConfig
    private let clock: BleTransferClock

    private weak var listener: Listener?
    private var state: BleTransferState = .idle
    private var chunks: [Int: BleTransferChunk] = [:]
    private var expectedTotal = 0
    private var receivedDigest: Data?
    private var negotiatedMtu = 0
    private var currentTransferId: Data?

    public init(
        transport: BleTransferTransport,
        config: BleTransferConfig = BleTransferConfig(),
        clock: BleTransferClock = SystemBleTransferClock()
    ) {
        self.transport = transport
        self.config = config
        self.clock = clock
        transport.setIncomingHandler { [weak self] in self?.handleData($0) }
    }

    public func setListener(_ listener: Listener?) {
        self.listener = listener
    }

    public func getState() -> BleTransferState { state }

    public func getReceivedChunkSeqs() -> [Int] {
        chunks.keys.sorted()
    }

    public func requestResume() {
        guard let transferId = currentTransferId else { return }
        let canResume =
            state == .resuming
            || (state == .ready && expectedTotal > 0 && chunks.count < expectedTotal)
        guard canResume else { return }
        let receivedSeqs = chunks.keys.sorted()
        var buffer = Data(count: 1 + 2 + 16 + receivedSeqs.count * 2)
        buffer[0] = BleTransferMessageType.resumeRequest.rawValue
        buffer[1] = UInt8((receivedSeqs.count >> 8) & 0xff)
        buffer[2] = UInt8(receivedSeqs.count & 0xff)
        buffer.replaceSubrange(3 ..< 19, with: transferId.prefix(16))
        var offset = 19
        for seq in receivedSeqs {
            buffer[offset] = UInt8((seq >> 8) & 0xff)
            buffer[offset + 1] = UInt8(seq & 0xff)
            offset += 2
        }
        transport.send(buffer)
        state = .ready
    }

    private func handleData(_ data: Data) {
        guard !data.isEmpty else { return }
        let msgType = Int(data[0])
        if msgType == Int(BleTransferMessageType.hello.rawValue), state == .idle {
            handleHello(data)
            return
        }
        let controlTypes: Set<Int> = [
            Int(BleTransferMessageType.transferVerified.rawValue),
            Int(BleTransferMessageType.hello.rawValue),
            Int(BleTransferMessageType.helloAck.rawValue),
            Int(BleTransferMessageType.ack.rawValue),
            Int(BleTransferMessageType.nack.rawValue),
            Int(BleTransferMessageType.resumeRequest.rawValue),
        ]
        if !controlTypes.contains(msgType), data.count >= BleTransferProtocolConstants.chunkHeaderSize {
            handleChunk(data)
        }
    }

    private func handleHello(_ data: Data) {
        if data.count < 20 {
            sendHelloAck(version: 0, mtu: 0, nonceEcho: Data(count: 16), status: BleTransferErrorCode.genericTimeout.rawValue)
            return
        }
        let version = Int(data[1])
        let nonce = data.subdata(in: 2 ..< 18)
        let mtu = (Int(data[18]) << 8) | Int(data[19])
        currentTransferId = nonce
        if version != BleTransferProtocolConstants.protocolVersion {
            sendHelloAck(version: version, mtu: 0, nonceEcho: nonce, status: BleTransferErrorCode.versionMismatch.rawValue)
            return
        }
        negotiatedMtu = min(config.mtu, mtu)
        sendHelloAck(
            version: BleTransferProtocolConstants.protocolVersion,
            mtu: negotiatedMtu,
            nonceEcho: nonce,
            status: 0
        )
        state = .ready
    }

    private func sendHelloAck(version: Int, mtu: Int, nonceEcho: Data, status: Int) {
        var buffer = Data(count: 21)
        buffer[0] = BleTransferMessageType.helloAck.rawValue
        buffer[1] = UInt8(version & 0xff)
        buffer.replaceSubrange(2 ..< 18, with: nonceEcho.prefix(16))
        buffer[18] = UInt8((mtu >> 8) & 0xff)
        buffer[19] = UInt8(mtu & 0xff)
        buffer[20] = UInt8(status & 0xff)
        transport.send(buffer)
    }

    private func handleChunk(_ data: Data) {
        guard state == .ready || state == .verifying else { return }
        guard let chunk = BleChunkCodec.deserializeChunk(data) else { return }
        let crc = BleChunkCodec.calculateCrc32(chunk.payload)
        if chunk.header.crc32 != crc {
            sendNack(seq: chunk.header.seq, reason: .crcMismatch)
            return
        }
        if expectedTotal == 0 {
            expectedTotal = chunk.header.total
        } else if chunk.header.total != expectedTotal {
            sendNack(seq: chunk.header.seq, reason: .totalMismatch)
            fail(.totalMismatch, "Total mismatch")
            return
        }
        if chunks[chunk.header.seq] != nil {
            sendAck(seq: chunk.header.seq)
            return
        }
        chunks[chunk.header.seq] = chunk
        sendAck(seq: chunk.header.seq)
        if chunks.count == expectedTotal {
            verifyAndComplete()
        }
    }

    private func verifyAndComplete() {
        state = .verifying
        do {
            var ordered: [BleTransferChunk] = []
            for index in 0 ..< expectedTotal {
                guard let chunk = chunks[index] else {
                    throw NSError(domain: "BleTransfer", code: 1, userInfo: [NSLocalizedDescriptionKey: "Missing chunk \(index)"])
                }
                ordered.append(chunk)
            }
            let lastChunk = ordered[ordered.count - 1]
            guard let extracted = BleChunkCodec.extractDigestFromLastChunk(lastChunk) else {
                sendDigestInvalidNack()
                fail(.digestInvalid, "Failed to extract digest")
                return
            }
            let (digest, lastData) = extracted
            receivedDigest = digest
            var modified = ordered
            modified[modified.count - 1] = BleTransferChunk(header: lastChunk.header, payload: lastData)
            let assembled = BleChunkCodec.assembleChunks(modified)
            if !BleChunkCodec.verifyDigest(assembled, digest: digest) {
                sendDigestInvalidNack()
                fail(.digestInvalid, "Digest verification failed")
                return
            }
            let transferId = currentTransferId ?? Data(count: 16)
            transport.send(BleTransferVerifiedMessage.encode(transferId: transferId, digest: digest))
            state = .completed
            listener?.onCompleted(payload: assembled)
        } catch {
            sendDigestInvalidNack()
            fail(.digestInvalid, error.localizedDescription)
        }
    }

    private func sendDigestInvalidNack() {
        guard expectedTotal > 0 else { return }
        sendNack(seq: expectedTotal - 1, reason: .digestInvalid)
    }

    private func sendAck(seq: Int) {
        var buffer = Data(count: 4)
        buffer[0] = BleTransferMessageType.ack.rawValue
        buffer[1] = UInt8((seq >> 8) & 0xff)
        buffer[2] = UInt8(seq & 0xff)
        buffer[3] = 0
        transport.send(buffer)
    }

    private func sendNack(seq: Int, reason: BleTransferErrorCode) {
        var buffer = Data(count: 4)
        buffer[0] = BleTransferMessageType.nack.rawValue
        buffer[1] = UInt8((seq >> 8) & 0xff)
        buffer[2] = UInt8(seq & 0xff)
        buffer[3] = UInt8(reason.rawValue & 0xff)
        transport.send(buffer)
    }

    private func fail(_ code: BleTransferErrorCode, _ message: String) {
        state = .failed
        listener?.onFailed(code: code, message: message)
    }

    public func onTransportDisconnected() {
        if state == .completed || state == .failed { return }
        if !chunks.isEmpty, expectedTotal > 0 {
            state = .resuming
        } else {
            fail(.genericTimeout, "Transport disconnected")
        }
    }

    public func close() {
        transport.close()
    }
}

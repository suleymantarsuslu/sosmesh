import Foundation

public enum BleTransferMessageType: UInt8 {
    case hello = 0x01
    case helloAck = 0x02
    case ack = 0x10
    case nack = 0x11
    case resumeRequest = 0x20
    case transferVerified = 0x21
}

public enum BleChunkFlags: Int {
    case firstChunk = 0x01
    case lastChunk = 0x02

    public func has(flags: Int) -> Bool { flags & rawValue != 0 }
}

public enum BleTransferErrorCode: Int, Equatable {
    case crcMismatch = 0x01
    case sequenceError = 0x02
    case timeout = 0x03
    case bufferFull = 0x04
    case versionMismatch = 0x10
    case digestInvalid = 0x11
    case totalMismatch = 0x12
    case genericTimeout = 0x20
}

public enum BleTransferState: Equatable {
    case idle
    case helloSent
    case ready
    case sending
    case waitAck
    case verifying
    case completed
    case failed
    case resuming
    case waitPeerVerified
}

public struct BleTransferConfig: Sendable {
    public var mtu: Int
    public var windowSize: Int
    public var chunkTimeoutMs: Int64
    public var maxRetries: Int
    public var retryJitterMs: Int64
    public var peerVerifyTimeoutMs: Int64

    public init(
        mtu: Int = 247,
        windowSize: Int = 4,
        chunkTimeoutMs: Int64 = 2_000,
        maxRetries: Int = 3,
        retryJitterMs: Int64 = 500,
        peerVerifyTimeoutMs: Int64 = 5_000
    ) {
        self.mtu = mtu
        self.windowSize = windowSize
        self.chunkTimeoutMs = chunkTimeoutMs
        self.maxRetries = maxRetries
        self.retryJitterMs = retryJitterMs
        self.peerVerifyTimeoutMs = peerVerifyTimeoutMs
    }
}

public enum BleTransferProtocolConstants {
    public static let protocolVersion: Int = 0x01
    public static let chunkHeaderSize: Int = 12
    public static let attOverhead: Int = 3
    public static let helloTimeoutMs: Int64 = 5_000
    public static let minMtu: Int = 100
    public static let maxMtu: Int = 512
}

public struct BleTransferChunkHeader: Equatable {
    public var seq: Int
    public var total: Int
    public var crc32: UInt32
    public var flags: Int

    public init(seq: Int, total: Int, crc32: UInt32, flags: Int) {
        self.seq = seq
        self.total = total
        self.crc32 = crc32
        self.flags = flags
    }
}

public struct BleTransferChunk: Equatable {
    public var header: BleTransferChunkHeader
    public var payload: Data

    public init(header: BleTransferChunkHeader, payload: Data) {
        self.header = header
        self.payload = payload
    }
}

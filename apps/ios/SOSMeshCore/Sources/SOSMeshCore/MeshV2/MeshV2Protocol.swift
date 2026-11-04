import CryptoKit
import Foundation

/// Mesh v2 constants and wire helpers (docs/protocol/mesh-v2.md). Byte layouts are big-endian.
public enum MeshV2 {
    public static let meshInfoCharacteristicUUID = "0000FFF4-0000-1000-8000-00805F9B34FB"
    public static let maxHops = 8
    public static let ttlHops = 8
    /// Origin `maxCopyCount`. The shared relay engines add 1 to `copyCount` on every forward, so the
    /// copy cap must stay above `maxHops + 1` or it would end the path before the hop limit (§2.3).
    public static let maxCopyCount = 16
    /// Local spray limit: a carried copy is handed to at most this many distinct peers.
    public static let maxPeersPerCopy = 4
    public static let timeTtlMs: Int64 = 86_400_000
    public static let seenCacheTtlMs: Int64 = 72 * 3_600_000
    public static let seenCacheCapacity = 4096
    public static let tombstoneTtlMs: Int64 = 72 * 3_600_000
    public static let tombstoneFutureSkewMs: Int64 = 300_000
    public static let tombstoneCapacity = 1024
    public static let tombstoneMaxHops: UInt8 = 8
    public static let carryCapacity = 200
    public static let carryCapacityBytes = 2 * 1024 * 1024
    public static let offline: UInt8 = 0xFF
    public static let gatewayFreshMs: Int64 = 60_000
    public static let neighborStaleMs: Int64 = 30_000
    public static let holdDownMs: Int64 = 15_000
    public static let maxOfferKeys = 8
    public static let maxTombstoneBatch = 16
    public static let offerReplyTimeoutMs: Int64 = 2_000
    public static let maxPayloadBytes = 4096

    /// First 16 bytes of SHA-256(UTF-8 messageId).
    public static func messageKey(_ messageId: String) -> Data {
        Data(SHA256.hash(data: Data(messageId.utf8)).prefix(16))
    }

    public static func sha256Hex(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    public static func hex(_ data: Data) -> String {
        data.map { String(format: "%02x", $0) }.joined()
    }

    /// iOS advertises `h` as one extra 16-bit service UUID `0xFFE0 + h` (§4.2).
    public static func hopsServiceUUID(_ hops: UInt8) -> String? {
        guard hops <= UInt8(maxHops) else { return nil }
        return String(format: "0000%04X-0000-1000-8000-00805F9B34FB", 0xFFE0 + Int(hops))
    }

    public static var allHopsServiceUUIDs: [String] {
        (0 ... UInt8(maxHops)).compactMap { hopsServiceUUID($0) }
    }

    /// Lowest `h` encoded in a list of advertised service UUIDs (16-bit or 128-bit spellings).
    public static func hops(fromServiceUUIDs uuids: [String]) -> UInt8? {
        var best: UInt8?
        for uuid in uuids {
            let canonical = BleMeshConstants.canonicalUuid(uuid)
            guard canonical.hasSuffix("-0000-1000-8000-00805F9B34FB"), canonical.hasPrefix("0000FFE") else { continue }
            let short = canonical.dropFirst(4).prefix(4)
            guard let value = UInt16(short, radix: 16), value >= 0xFFE0, value <= 0xFFE0 + UInt16(maxHops) else { continue }
            let h = UInt8(value - 0xFFE0)
            best = min(best ?? h, h)
        }
        return best
    }

    /// Android service data for FFF0: `[0x02][h][flags]`.
    public static func hops(fromServiceData data: Data) -> UInt8? {
        let bytes = [UInt8](data)
        guard bytes.count >= 2, bytes[0] == 0x02 else { return nil }
        return bytes[1]
    }

    public static func parseISO8601Ms(_ text: String) -> Int64? {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = withFraction.date(from: text) { return Int64(date.timeIntervalSince1970 * 1000) }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        if let date = plain.date(from: text) { return Int64(date.timeIntervalSince1970 * 1000) }
        return nil
    }

    public static func iso8601(ms: Int64) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: Date(timeIntervalSince1970: TimeInterval(ms) / 1000))
    }
}

public enum MeshOfferStatus: UInt8, Equatable {
    case want = 0
    case have = 1
    case delivered = 2
    case full = 3
    case refused = 4
}

public struct ServerBroadcast: Equatable {
    public let id: String
    public let title: String
    public let body: String
    public let severity: String
    public let kind: String
    public let createdAt: String
    public let expiresAt: String
    public let regionLat: Double?
    public let regionLng: Double?
    public let regionRadiusKm: Double?
    public let signature: String
    public let hopsLeft: UInt8

    public init(
        id: String,
        title: String,
        body: String,
        severity: String,
        kind: String = "standard",
        createdAt: String,
        expiresAt: String,
        regionLat: Double? = nil,
        regionLng: Double? = nil,
        regionRadiusKm: Double? = nil,
        signature: String,
        hopsLeft: UInt8
    ) {
        self.id = id
        self.title = title
        self.body = body
        self.severity = severity
        self.kind = kind
        self.createdAt = createdAt
        self.expiresAt = expiresAt
        self.regionLat = regionLat
        self.regionLng = regionLng
        self.regionRadiusKm = regionRadiusKm
        self.signature = signature
        self.hopsLeft = hopsLeft
    }
}

/// Server-signed delivery tombstone = the `/v1/ingest` receipt + unsigned `hopsLeft` (§6).
public struct DeliveryTombstone: Codable, Equatable {
    public var ackType: String
    public var messageId: String
    public var packetHash: String
    public var timestamp: String
    public var signature: String
    public var hopsLeft: UInt8?

    public init(ackType: String = "SERVER_ACCEPTED", messageId: String, packetHash: String, timestamp: String, signature: String, hopsLeft: UInt8? = MeshV2.tombstoneMaxHops) {
        self.ackType = ackType
        self.messageId = messageId
        self.packetHash = packetHash
        self.timestamp = timestamp
        self.signature = signature
        self.hopsLeft = hopsLeft
    }

    public init(receipt: ServerAcceptedReceipt) {
        self.init(ackType: receipt.ackType, messageId: receipt.messageId, packetHash: receipt.packetHash, timestamp: receipt.timestamp, signature: receipt.signature)
    }

    public var messageKey: Data { MeshV2.messageKey(messageId) }
}

/// v2 control frames on FFF1 (central → peripheral) and FFF3 (peripheral → central), §5.2.
public enum MeshV2Frame: Equatable {
    case offer([Data])
    case offerReply([MeshOfferStatus])
    case tombstoneRequest([Data])
    case tombstone(DeliveryTombstone)
    case broadcast(ServerBroadcast)

    public static let offerType: UInt8 = 0x30
    public static let offerReplyType: UInt8 = 0x31
    public static let tombstoneRequestType: UInt8 = 0x32
    public static let tombstoneType: UInt8 = 0x34
    public static let broadcastType: UInt8 = 0x35

    /// v1 control types are 0x01..0x21, so a first byte in 0x30...0x35 is always a v2 frame.
    public static func isMeshV2(_ data: Data) -> Bool {
        guard let first = data.first else { return false }
        return (0x30 ... 0x35).contains(first)
    }

    public func encode() -> Data? {
        switch self {
        case .offer(let keys):
            return Self.encodeKeys(Self.offerType, keys)
        case .tombstoneRequest(let keys):
            return Self.encodeKeys(Self.tombstoneRequestType, keys)
        case .offerReply(let statuses):
            guard (1 ... MeshV2.maxOfferKeys).contains(statuses.count) else { return nil }
            return Data([Self.offerReplyType, UInt8(statuses.count)] + statuses.map(\.rawValue))
        case .tombstone(let t):
            let id = Data(t.messageId.utf8)
            let ts = Data(t.timestamp.utf8)
            guard id.count <= 64, ts.count <= 32,
                  let hash = Self.hexBytes(t.packetHash), hash.count == 32,
                  let sig = Data(base64Encoded: t.signature), sig.count == 64 else { return nil }
            var out = Data([Self.tombstoneType, UInt8(id.count)])
            out.append(id)
            out.append(hash)
            out.append(UInt8(ts.count))
            out.append(ts)
            out.append(sig)
            out.append(t.hopsLeft ?? 0)
            return out
        case .broadcast(let b):
            let id = Data(b.id.utf8)
            let title = Data(b.title.utf8)
            let body = Data(b.body.utf8)
            let severity = Data(b.severity.utf8)
            let kind = Data(b.kind.utf8)
            let createdAt = Data(b.createdAt.utf8)
            let expiresAt = Data(b.expiresAt.utf8)
            guard id.count <= 64, title.count <= 200, body.count <= 5000,
                  let sig = Data(base64Encoded: b.signature), sig.count == 64 else { return nil }
            var out = Data([Self.broadcastType, UInt8(id.count)])
            out.append(id)
            out.append(UInt8(title.count))
            out.append(title)
            let bodySize = UInt16(body.count)
            out.append(UInt8((bodySize >> 8) & 0xFF))
            out.append(UInt8(bodySize & 0xFF))
            out.append(body)
            out.append(UInt8(severity.count))
            out.append(severity)
            out.append(UInt8(kind.count))
            out.append(kind)
            out.append(UInt8(createdAt.count))
            out.append(createdAt)
            out.append(UInt8(expiresAt.count))
            out.append(expiresAt)
            let hasRegion = b.regionLat != nil && b.regionLng != nil && b.regionRadiusKm != nil
            out.append(hasRegion ? 1 : 0)
            if hasRegion {
                let latBytes = Data("\(b.regionLat!)".utf8)
                let lngBytes = Data("\(b.regionLng!)".utf8)
                let radiusBytes = Data("\(b.regionRadiusKm!)".utf8)
                out.append(UInt8(latBytes.count))
                out.append(latBytes)
                out.append(UInt8(lngBytes.count))
                out.append(lngBytes)
                out.append(UInt8(radiusBytes.count))
                out.append(radiusBytes)
            }
            out.append(sig)
            out.append(b.hopsLeft)
            return out
        }
    }

    public static func decode(_ data: Data) -> MeshV2Frame? {
        let b = [UInt8](data)
        guard let type = b.first else { return nil }
        switch type {
        case offerType, tombstoneRequestType:
            guard b.count >= 2 else { return nil }
            let n = Int(b[1])
            guard (1 ... MeshV2.maxOfferKeys).contains(n), b.count == 2 + 16 * n else { return nil }
            let keys = (0 ..< n).map { Data(b[(2 + 16 * $0) ..< (18 + 16 * $0)]) }
            return type == offerType ? .offer(keys) : .tombstoneRequest(keys)
        case offerReplyType:
            guard b.count >= 2 else { return nil }
            let n = Int(b[1])
            guard (1 ... MeshV2.maxOfferKeys).contains(n), b.count == 2 + n else { return nil }
            return .offerReply(b[2...].map { MeshOfferStatus(rawValue: $0) ?? .refused })
        case tombstoneType:
            var i = 1
            guard b.count > i else { return nil }
            let idLen = Int(b[i]); i += 1
            guard idLen <= 64, b.count >= i + idLen + 32 + 1 else { return nil }
            guard let id = String(bytes: b[i ..< i + idLen], encoding: .utf8) else { return nil }
            i += idLen
            let hash = MeshV2.hex(Data(b[i ..< i + 32])); i += 32
            let tsLen = Int(b[i]); i += 1
            guard tsLen <= 32, b.count == i + tsLen + 64 + 1,
                  let ts = String(bytes: b[i ..< i + tsLen], encoding: .utf8) else { return nil }
            i += tsLen
            let sig = Data(b[i ..< i + 64]).base64EncodedString(); i += 64
            return .tombstone(DeliveryTombstone(messageId: id, packetHash: hash, timestamp: ts, signature: sig, hopsLeft: b[i]))
        case broadcastType:
            var i = 1
            guard b.count > i else { return nil }
            let idLen = Int(b[i]); i += 1
            guard let id = String(bytes: b[i ..< i + idLen], encoding: .utf8) else { return nil }
            i += idLen
            guard b.count > i else { return nil }
            let titleLen = Int(b[i]); i += 1
            guard let title = String(bytes: b[i ..< i + titleLen], encoding: .utf8) else { return nil }
            i += titleLen
            guard b.count > i + 1 else { return nil }
            let bodyLen = (Int(b[i]) << 8) | Int(b[i + 1]); i += 2
            guard let body = String(bytes: b[i ..< i + bodyLen], encoding: .utf8) else { return nil }
            i += bodyLen
            guard b.count > i else { return nil }
            let severityLen = Int(b[i]); i += 1
            guard let severity = String(bytes: b[i ..< i + severityLen], encoding: .utf8) else { return nil }
            i += severityLen
            let kind: String
            if i < b.count {
                let kindLen = Int(b[i]); i += 1
                if kindLen > 0 && i + kindLen <= b.count {
                    guard let k = String(bytes: b[i ..< i + kindLen], encoding: .utf8) else { return nil }
                    kind = k
                    i += kindLen
                } else {
                    kind = "standard"
                }
            } else {
                kind = "standard"
            }
            guard b.count > i else { return nil }
            let createdAtLen = Int(b[i]); i += 1
            guard let createdAt = String(bytes: b[i ..< i + createdAtLen], encoding: .utf8) else { return nil }
            i += createdAtLen
            guard b.count > i else { return nil }
            let expiresAtLen = Int(b[i]); i += 1
            guard let expiresAt = String(bytes: b[i ..< i + expiresAtLen], encoding: .utf8) else { return nil }
            i += expiresAtLen
            guard b.count > i else { return nil }
            let hasRegion = b[i]; i += 1
            var regionLat: Double?
            var regionLng: Double?
            var regionRadiusKm: Double?
            if hasRegion == 1 {
                guard b.count > i else { return nil }
                let latLen = Int(b[i]); i += 1
                guard let latStr = String(bytes: b[i ..< i + latLen], encoding: .utf8),
                      let lat = Double(latStr) else { return nil }
                i += latLen
                guard b.count > i else { return nil }
                let lngLen = Int(b[i]); i += 1
                guard let lngStr = String(bytes: b[i ..< i + lngLen], encoding: .utf8),
                      let lng = Double(lngStr) else { return nil }
                i += lngLen
                guard b.count > i else { return nil }
                let radiusLen = Int(b[i]); i += 1
                guard let radiusStr = String(bytes: b[i ..< i + radiusLen], encoding: .utf8),
                      let radius = Double(radiusStr) else { return nil }
                i += radiusLen
                regionLat = lat
                regionLng = lng
                regionRadiusKm = radius
            }
            guard b.count == i + 64 + 1 else { return nil }
            let sig = Data(b[i ..< i + 64]).base64EncodedString(); i += 64
            let hops = b[i]
            return .broadcast(ServerBroadcast(
                id: id,
                title: title,
                body: body,
                severity: severity,
                kind: kind,
                createdAt: createdAt,
                expiresAt: expiresAt,
                regionLat: regionLat,
                regionLng: regionLng,
                regionRadiusKm: regionRadiusKm,
                signature: sig,
                hopsLeft: hops
            ))
        default:
            return nil
        }
    }

    private static func encodeKeys(_ type: UInt8, _ keys: [Data]) -> Data? {
        guard (1 ... MeshV2.maxOfferKeys).contains(keys.count), keys.allSatisfy({ $0.count == 16 }) else { return nil }
        var out = Data([type, UInt8(keys.count)])
        keys.forEach { out.append($0) }
        return out
    }

    static func hexBytes(_ hex: String) -> Data? {
        guard hex.count % 2 == 0 else { return nil }
        var out = Data()
        var index = hex.startIndex
        while index < hex.endIndex {
            let next = hex.index(index, offsetBy: 2)
            guard let byte = UInt8(hex[index ..< next], radix: 16) else { return nil }
            out.append(byte)
            index = next
        }
        return out
    }
}

/// FFF4 MESH_INFO, 16 bytes (§5.3).
public struct MeshInfo: Equatable {
    public static let flagRelay: UInt8 = 0x01
    public static let flagAcceptsCarry: UInt8 = 0x02
    public static let flagWatch: UInt8 = 0x04
    public static let flagOwnPending: UInt8 = 0x08

    public var version: UInt8 = 0x02
    public var hops: UInt8
    public var flags: UInt8
    public var carryFillPercent: UInt8
    public var secondsSinceConfirmed: UInt16
    public var selfKey: UInt32
    public var parentKey: UInt32

    public init(hops: UInt8, flags: UInt8, carryFillPercent: UInt8, secondsSinceConfirmed: UInt16, selfKey: UInt32, parentKey: UInt32) {
        self.hops = hops
        self.flags = flags
        self.carryFillPercent = carryFillPercent
        self.secondsSinceConfirmed = secondsSinceConfirmed
        self.selfKey = selfKey
        self.parentKey = parentKey
    }

    public func encode() -> Data {
        var b = [UInt8](repeating: 0, count: 16)
        b[0] = version
        b[1] = hops
        b[2] = flags
        b[3] = min(carryFillPercent, 100)
        b[4] = UInt8(secondsSinceConfirmed >> 8); b[5] = UInt8(secondsSinceConfirmed & 0xFF)
        for i in 0 ..< 4 {
            b[6 + i] = UInt8((selfKey >> (24 - 8 * UInt32(i))) & 0xFF)
            b[10 + i] = UInt8((parentKey >> (24 - 8 * UInt32(i))) & 0xFF)
        }
        return Data(b)
    }

    public static func decode(_ data: Data) -> MeshInfo? {
        let b = [UInt8](data)
        guard b.count >= 16, b[0] == 0x02 else { return nil }
        func u32(_ o: Int) -> UInt32 { (0 ..< 4).reduce(UInt32(0)) { ($0 << 8) | UInt32(b[o + $1]) } }
        var info = MeshInfo(hops: b[1], flags: b[2], carryFillPercent: b[3], secondsSinceConfirmed: (UInt16(b[4]) << 8) | UInt16(b[5]), selfKey: u32(6), parentKey: u32(10))
        info.version = b[0]
        return info
    }

    /// `selfKey` = first 4 bytes of SHA-256(relayId ‖ UTC day number), rotating daily.
    public static func selfKey(relayIdHex: String, nowMs: Int64) -> UInt32 {
        let day = nowMs / 86_400_000
        let digest = [UInt8](SHA256.hash(data: Data((relayIdHex + String(day)).utf8)))
        return (0 ..< 4).reduce(UInt32(0)) { ($0 << 8) | UInt32(digest[$1]) }
    }
}

extension MeshV2 {
    static func writeProtected(_ data: Data, to url: URL) {
        #if os(iOS) || os(watchOS)
        try? data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        #else
        try? data.write(to: url, options: [.atomic])
        #endif
    }
}

import Foundation

public enum WatchCompanionCodec {
    private static let encoder: JSONEncoder = {
        let enc = JSONEncoder()
        enc.outputFormatting = [.sortedKeys]
        return enc
    }()

    private static let decoder = JSONDecoder()

    public static func encodeCreate(_ wire: WatchSosCreateWire) throws -> Data {
        try encoder.encode(wire)
    }

    public static func decodeCreate(_ data: Data) throws -> WatchSosCreateWire {
        try decoder.decode(WatchSosCreateWire.self, from: data)
    }

    public static func encodeAck(_ wire: WatchPhoneAckWire) throws -> Data {
        try encoder.encode(wire)
    }

    public static func decodeAck(_ data: Data) throws -> WatchPhoneAckWire {
        try decoder.decode(WatchPhoneAckWire.self, from: data)
    }
}

import Foundation

public enum BleTransferVerifiedMessage {
    public static let wireSize = 49

    public static func encode(transferId: Data, digest: Data) -> Data {
        precondition(transferId.count >= 16)
        precondition(digest.count == 32)
        var buffer = Data(count: wireSize)
        buffer[0] = BleTransferMessageType.transferVerified.rawValue
        buffer.replaceSubrange(1 ..< 17, with: transferId.prefix(16))
        buffer.replaceSubrange(17 ..< 49, with: digest.prefix(32))
        return buffer
    }

    public static func decode(_ data: Data) -> (transferId: Data, digest: Data)? {
        guard data.count >= wireSize else { return nil }
        guard data[0] == BleTransferMessageType.transferVerified.rawValue else { return nil }
        let transferId = data.subdata(in: 1 ..< 17)
        let digest = data.subdata(in: 17 ..< 49)
        return (transferId, digest)
    }
}

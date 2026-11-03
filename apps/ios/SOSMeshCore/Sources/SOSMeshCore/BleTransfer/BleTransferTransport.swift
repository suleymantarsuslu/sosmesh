import Foundation

public protocol BleTransferTransport: AnyObject {
    func send(_ data: Data)
    func setIncomingHandler(_ handler: ((Data) -> Void)?)
    func close()
}

public protocol GattOutboundWriting: AnyObject {
    func writeCharacteristic(uuid: String, value: Data)
}

/// Routes protocol frames to GATT characteristics (ble-v1.md), matching Android `GattBleTransferTransport`.
public final class GattBleTransferTransport: BleTransferTransport {
    private let outbound: GattOutboundWriting
    private var incoming: ((Data) -> Void)?

    public init(outbound: GattOutboundWriting) {
        self.outbound = outbound
    }

    public func send(_ data: Data) {
        guard !data.isEmpty else { return }
        let type = Int(data[0])
        let uuid: String
        switch type {
        case Int(BleTransferMessageType.hello.rawValue),
             Int(BleTransferMessageType.resumeRequest.rawValue):
            uuid = BleMeshConstants.controlCharacteristicUUID
        case Int(BleTransferMessageType.helloAck.rawValue),
             Int(BleTransferMessageType.ack.rawValue),
             Int(BleTransferMessageType.nack.rawValue),
             Int(BleTransferMessageType.transferVerified.rawValue):
            uuid = BleMeshConstants.ackCharacteristicUUID
        default:
            uuid = BleMeshConstants.dataCharacteristicUUID
        }
        outbound.writeCharacteristic(uuid: uuid, value: data)
    }

    public func deliverIncoming(uuid: String, value: Data) {
        guard !value.isEmpty else { return }
        let normalized = uuid.uppercased()
        let allowed = [
            BleMeshConstants.controlCharacteristicUUID.uppercased(),
            BleMeshConstants.dataCharacteristicUUID.uppercased(),
            BleMeshConstants.ackCharacteristicUUID.uppercased(),
        ]
        guard allowed.contains(normalized) else { return }
        incoming?(value)
    }

    public func setIncomingHandler(_ handler: ((Data) -> Void)?) {
        incoming = handler
    }

    public func close() {
        incoming = nil
    }
}

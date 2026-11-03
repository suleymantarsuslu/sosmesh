import Foundation
@testable import SOSMeshCore

final class MockBleTransferChannel {
    let packetLoss: Double
    let duplicateRate: Double
    private let rng: BleTransferRng
    private var pending: [(GattBleTransferTransport, String, Data)] = []

    init(packetLoss: Double, duplicateRate: Double, rng: BleTransferRng) {
        self.packetLoss = packetLoss
        self.duplicateRate = duplicateRate
        self.rng = rng
    }

    func createTransportPair() -> (GattBleTransferTransport, GattBleTransferTransport) {
        var senderTransport: GattBleTransferTransport!
        var receiverTransport: GattBleTransferTransport!
        senderTransport = GattBleTransferTransport(
            outbound: RelayOutbound { uuid, value in
                self.route(from: senderTransport, uuid: uuid, value: value, peer: receiverTransport)
            }
        )
        receiverTransport = GattBleTransferTransport(
            outbound: RelayOutbound { uuid, value in
                self.route(from: receiverTransport, uuid: uuid, value: value, peer: senderTransport)
            }
        )
        return (senderTransport, receiverTransport)
    }

    func drain() {
        while !pending.isEmpty {
            let item = pending.removeFirst()
            item.0.deliverIncoming(uuid: item.1, value: item.2)
        }
    }

    private func route(
        from: GattBleTransferTransport,
        uuid: String,
        value: Data,
        peer: GattBleTransferTransport
    ) {
        if rng.nextUnit() < packetLoss { return }
        pending.append((peer, uuid, value))
        if rng.nextUnit() < duplicateRate {
            pending.append((peer, uuid, value))
        }
    }

    private final class RelayOutbound: GattOutboundWriting {
        let handler: (String, Data) -> Void
        init(_ handler: @escaping (String, Data) -> Void) { self.handler = handler }
        func writeCharacteristic(uuid: String, value: Data) { handler(uuid, value) }
    }
}

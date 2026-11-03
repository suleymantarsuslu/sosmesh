import Foundation
import SOSMeshContracts

public enum BleAuthorizationSnapshot: Equatable {
    case unknown
    case poweredOn
    case poweredOff
    case unauthorized
    case unsupported
}

public struct BleRadioSnapshot: Equatable {
    public var authorization: BleAuthorizationSnapshot
    public var scanning: Bool
    public var advertising: Bool
    public var peerCount: Int
    public var gattReady: Bool
    public var statusMessage: String

    public init(
        authorization: BleAuthorizationSnapshot,
        scanning: Bool,
        advertising: Bool,
        peerCount: Int,
        gattReady: Bool,
        statusMessage: String
    ) {
        self.authorization = authorization
        self.scanning = scanning
        self.advertising = advertising
        self.peerCount = peerCount
        self.gattReady = gattReady
        self.statusMessage = statusMessage
    }
}

public protocol GattServerPort: AnyObject {
    func start() -> Result<Void, Error>
    func stop()
    func setWriteListener(_ listener: GattServerWriteListener?)
    func notifyCharacteristic(uuid: String, value: Data, deviceAddress: String?) -> Result<Void, Error>
}

public protocol GattServerWriteListener: AnyObject {
    func onCharacteristicWrite(uuid: String, value: Data, deviceAddress: String)
}

public protocol GattClientPort: AnyObject {
    func connect(peerAddress: String, serviceUuid: String, callback: GattClientCallbackPort) -> Result<Void, Error>
    func disconnect()
    func discoverServices()
    func requestMtu(_ preferred: Int) -> Result<Void, Error>
    func writeCharacteristic(uuid: String, value: Data)
    func enableAckNotifications()
    func setClientDataListener(_ listener: GattClientCallbackPort?)
}

public protocol GattClientCallbackPort: AnyObject {
    func onConnectionStateChanged(_ state: GattConnectionState)
    func onServicesDiscovered()
    func onMtuChanged(mtu: Int)
    func onCharacteristicChanged(uuid: String, value: Data)
}

public enum GattConnectionState {
    case connecting
    case connected
    case discovering
    case ready
    case disconnected
}

public protocol BleMeshRadioPort: AnyObject {
    func startDiscovery(role: BlePeerRole, relayEnabled: Bool, pendingSos: Bool) -> Result<Void, Error>
    func stopDiscovery()
    func refreshSnapshot() -> BleRadioSnapshot
    func tick(nowMs: Int64)
    func connectFirstPeerIfNeeded() -> Result<Void, Error>
    var transferEngine: BleTransferEngine { get }
}

public struct ReceivedSosRecord: Equatable, Identifiable {
    public var id: String { sosId }
    public let sosId: String
    public let digest: String
    public let receivedAtMs: Int64

    public init(sosId: String, digest: String, receivedAtMs: Int64) {
        self.sosId = sosId
        self.digest = digest
        self.receivedAtMs = receivedAtMs
    }
}

public final class ReceivedSosInbox: @unchecked Sendable {
    private var records: [ReceivedSosRecord] = []
    private let lock = NSLock()

    public init() {}

    public func append(sosId: String, digest: String, nowMs: Int64) {
        lock.lock()
        defer { lock.unlock() }
        records.append(ReceivedSosRecord(sosId: sosId, digest: digest, receivedAtMs: nowMs))
    }

    public func list() -> [ReceivedSosRecord] {
        lock.lock()
        defer { lock.unlock() }
        return records
    }
}

public final class BleIncomingPayloadRouter: BleTransferReceiver.Listener {
    private let inbox: ReceivedSosInbox
    private let nowMs: () -> Int64

    public init(inbox: ReceivedSosInbox, nowMs: @escaping () -> Int64 = { Int64(Date().timeIntervalSince1970 * 1000) }) {
        self.inbox = inbox
        self.nowMs = nowMs
    }

    public func onCompleted(payload: Data) {
        guard let json = String(data: payload, encoding: .utf8),
              let data = json.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let sosId = object["id"] as? String
        else {
            return
        }
        let digest = BleProtocol.calculateSHA256(payload).base64EncodedString()
        inbox.append(sosId: sosId, digest: digest, nowMs: nowMs())
    }

    public func onFailed(code: BleTransferErrorCode, message: String) {}
}

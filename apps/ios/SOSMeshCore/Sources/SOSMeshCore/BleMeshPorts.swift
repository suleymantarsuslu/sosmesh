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
    /// Opaque SOS wire envelope exactly as received (outer JSON with the encrypted payload).
    /// The relay stores and forwards these bytes unchanged and never opens the encrypted payload.
    public let envelope: Data?
    /// Set only after the server accepted the packet (signed receipt verified).
    public let forwardedAtMs: Int64?

    public var isForwarded: Bool { forwardedAtMs != nil }

    public init(
        sosId: String,
        digest: String,
        receivedAtMs: Int64,
        envelope: Data? = nil,
        forwardedAtMs: Int64? = nil
    ) {
        self.sosId = sosId
        self.digest = digest
        self.receivedAtMs = receivedAtMs
        self.envelope = envelope
        self.forwardedAtMs = forwardedAtMs
    }
}

public final class ReceivedSosInbox: @unchecked Sendable {
    private var records: [ReceivedSosRecord] = []
    private let lock = NSLock()

    public init() {}

    public func append(sosId: String, digest: String, nowMs: Int64) {
        append(sosId: sosId, digest: digest, envelope: nil, nowMs: nowMs)
    }

    /// Stores a received envelope once per (sosId, digest); duplicates (peer retries) are ignored.
    @discardableResult
    public func append(sosId: String, digest: String, envelope: Data?, nowMs: Int64) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        if envelope != nil,
           records.contains(where: { $0.sosId == sosId && $0.digest == digest }) {
            return false
        }
        records.append(ReceivedSosRecord(sosId: sosId, digest: digest, receivedAtMs: nowMs, envelope: envelope))
        return true
    }

    public func markForwarded(sosId: String, digest: String, nowMs: Int64) {
        lock.lock()
        defer { lock.unlock() }
        guard let index = records.firstIndex(where: { $0.sosId == sosId && $0.digest == digest }) else {
            return
        }
        let old = records[index]
        records[index] = ReceivedSosRecord(
            sosId: old.sosId,
            digest: old.digest,
            receivedAtMs: old.receivedAtMs,
            envelope: old.envelope,
            forwardedAtMs: nowMs
        )
    }

    public func list() -> [ReceivedSosRecord] {
        lock.lock()
        defer { lock.unlock() }
        return records
    }
}

/// Durable store for received envelopes (the app backs it with the on-disk outbox, origin `relay`).
public protocol ReceivedEnvelopeStoring: AnyObject {
    func storeReceivedEnvelope(sosId: String, digest: String, envelope: Data, nowMs: Int64) throws
}

public final class BleIncomingPayloadRouter: BleTransferReceiver.Listener {
    private let inbox: ReceivedSosInbox
    private let nowMs: () -> Int64
    private let store: ReceivedEnvelopeStoring?
    private let diagnostics: RelayDiagnostics?

    public init(
        inbox: ReceivedSosInbox,
        store: ReceivedEnvelopeStoring? = nil,
        diagnostics: RelayDiagnostics? = nil,
        nowMs: @escaping () -> Int64 = { Int64(Date().timeIntervalSince1970 * 1000) }
    ) {
        self.inbox = inbox
        self.store = store
        self.diagnostics = diagnostics
        self.nowMs = nowMs
    }

    public func onCompleted(payload: Data) {
        // Only the outer wire JSON is parsed (to read the message id); the encrypted payload
        // inside stays opaque.
        guard let json = String(data: payload, encoding: .utf8),
              let data = json.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let sosId = object["id"] as? String
        else {
            return
        }
        let digest = BleProtocol.calculateSHA256(payload).base64EncodedString()
        let now = nowMs()
        let isNew = inbox.append(sosId: sosId, digest: digest, envelope: payload, nowMs: now)
        diagnostics?.recordReceived(sosId: sosId, nowMs: now)
        guard isNew else { return }
        do {
            try store?.storeReceivedEnvelope(sosId: sosId, digest: digest, envelope: payload, nowMs: now)
        } catch {
            diagnostics?.recordError(code: "relay_store_failed")
        }
    }

    public func onFailed(code: BleTransferErrorCode, message: String) {
        diagnostics?.recordError(code: "recv_\(code.rawValue)")
    }
}

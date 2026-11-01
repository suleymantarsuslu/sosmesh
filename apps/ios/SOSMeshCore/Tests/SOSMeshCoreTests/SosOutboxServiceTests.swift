import XCTest
@testable import SOSMeshCore
import SOSMeshContracts

final class SosOutboxServiceTests: XCTestCase {
    func sourceRoot() -> String {
        if let envRoot = ProcessInfo.processInfo.environment["SOURCE_ROOT"] {
            return envRoot
        }
        var url = URL(fileURLWithPath: #filePath)
        for _ in 0..<5 {
            url.deleteLastPathComponent()
        }
        return url.path
    }

    func testOfflineQueueSurvivesReopen() throws {
        let tmp = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("ios-outbox-\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: tmp) }
        let service = try SosOutboxService(storePath: tmp.path, sourceRoot: sourceRoot())
        _ = try service.enqueueLocalSos(
            input: EnqueueInput(
                sosId: "ios-1",
                digest: "abc",
                origin: "device",
                encryptedBlobBase64: "YQ=="
            ),
            nowMs: 1
        )
        let reopened = try SosOutboxService(storePath: tmp.path, sourceRoot: sourceRoot())
        XCTAssertEqual(try reopened.listEntries().count, 1)
    }

    func testPeerAckNotServerAccepted() throws {
        let tmp = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("ios-outbox-peer-\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: tmp) }
        let service = try SosOutboxService(storePath: tmp.path, sourceRoot: sourceRoot())
        let peer = try service.markPeerReceived(sosId: "x", digest: "d", fromState: "LOCAL_SAVED")
        XCTAssertTrue(service.peerAckIsNotServerAccepted(peer))
    }
}

import Foundation
import XCTest
@testable import SOSMeshCore

final class CrossPlatformAckGateFixtureTests: XCTestCase {
    func testTransferAckGateFixtureFileExists() throws {
        let url = repoRoot()
            .appendingPathComponent("packages/fixtures/cross-platform/transfer-ack-gate.json")
        XCTAssertTrue(FileManager.default.fileExists(atPath: url.path))
        let data = try Data(contentsOf: url)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let cases = json?["cases"] as? [[String: Any]]
        XCTAssertGreaterThan(cases?.count ?? 0, 0)

        for caseObj in cases ?? [] {
            guard let input = caseObj["input"] as? [String: Any],
                  let expect = caseObj["expect"] as? [String: Any] else {
                continue
            }
            if let crcValid = input["crcValid"] as? Bool {
                let result = CrossPlatformAckDeliveryGate.evaluateTransfer(
                    CrossPlatformAckTransferInput(
                        crcValid: crcValid,
                        digestValid: input["digestValid"] as? Bool ?? false,
                        chunkAcksComplete: input["chunkAcksComplete"] as? Bool ?? false,
                        transferVerified: input["transferVerified"] as? Bool ?? false
                    )
                )
                XCTAssertEqual(result.mayEmitPeerReceived, expect["mayEmitPeerReceived"] as? Bool)
                XCTAssertEqual(result.mayEmitServerAccepted, expect["mayEmitServerAccepted"] as? Bool)
            }
            if let deliveryState = input["deliveryState"] as? String {
                let state = CrossPlatformAckDeliveryGate.evaluateDeliveryState(deliveryState)
                XCTAssertEqual(state.mayEmitPeerReceived, expect["mayEmitPeerReceived"] as? Bool)
                XCTAssertEqual(state.mayEmitServerAccepted, expect["mayEmitServerAccepted"] as? Bool)
            }
        }
    }

    func testMutationChunkAckOnlyDiffersFromProductionGate() {
        let input = CrossPlatformAckTransferInput(
            crcValid: true,
            digestValid: true,
            chunkAcksComplete: true,
            transferVerified: false
        )
        XCTAssertFalse(CrossPlatformAckDeliveryGate.evaluateTransfer(input).mayEmitPeerReceived)
        XCTAssertTrue(CrossPlatformAckDeliveryGate.peerReceivedIfIgnoringVerified(input))
    }

    private func repoRoot() -> URL {
        let cwd = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        if FileManager.default.fileExists(atPath: cwd.appendingPathComponent("packages/fixtures").path) {
            return cwd
        }
        return cwd.deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
    }
}

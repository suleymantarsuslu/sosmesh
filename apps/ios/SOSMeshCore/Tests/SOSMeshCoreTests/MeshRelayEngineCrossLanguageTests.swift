import Foundation
import XCTest
@testable import SOSMeshCore

final class MeshRelayEngineCrossLanguageTests: XCTestCase {
    func testRelayEngineVectorsMatchGolden() throws {
        let url = repoRoot()
            .appendingPathComponent("packages/contracts/protocol-v2/vectors/relay-engine-cases.json")
        let data = try Data(contentsOf: url)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let cases = json?["cases"] as? [[String: Any]]
        XCTAssertGreaterThan(cases?.count ?? 0, 0)

        for caseObj in cases ?? [] {
            let id = caseObj["id"] as? String ?? "unknown"
            let relayHash = caseObj["relayDeviceIdHash"] as? String ?? ""
            guard let envelopeObj = caseObj["envelope"] as? [String: Any],
                  let expect = caseObj["expect"] as? [String: Any] else {
                XCTFail("Missing envelope for \(id)")
                continue
            }
            let envelope = try decodeEnvelope(envelopeObj)
            let engine = MeshRelayEngineFactory.createRelayEngine(lruCapacity: 256)
            if let preSeen = caseObj["previouslySeenDedupKey"] as? String {
                engine.seedDedupKey(preSeen)
            }
            let outcome = engine.evaluateForward(envelope: envelope, relayDeviceIdHash: relayHash)
            let decision = expect["decision"] as? String
            XCTAssertEqual(outcome.decision.rawValue, decision, "case \(id)")
            if let dropReason = expect["dropReason"] as? String {
                XCTAssertEqual(outcome.dropReason?.rawValue, dropReason, "case \(id)")
            }
            if outcome.decision == .forward, let forward = outcome.forward {
                if let hop = expect["forwardHopCount"] as? Int {
                    XCTAssertEqual(forward.hopCount, hop, "case \(id)")
                }
                if let ttl = expect["forwardTtlHops"] as? Int {
                    XCTAssertEqual(forward.ttlHops, ttl, "case \(id)")
                }
                if let copy = expect["forwardCopyCount"] as? Int {
                    XCTAssertEqual(forward.copyCount, copy, "case \(id)")
                }
            }
        }
    }

    func testExperimentalMultihopDisabledByDefault() {
        MeshRelayFeatureFlags.setExperimentalMultihopRelayEnabled(false)
        let coordinator = MeshMultihopRelayCoordinator(lruCapacity: 8)
        let envelope = MeshRelayEnvelopeV2(
            protocolVersion: 2,
            messageId: "flag-off",
            hopCount: 0,
            maxHops: 5,
            ttlHops: 2,
            copyCount: 1,
            maxCopyCount: 3,
            originCreatedAt: "2026-11-01T12:00:00Z",
            opaqueCiphertextBase64: "dGVzdA==",
            hopChainReceipt: HopChainReceiptV2()
        )
        let relayHash = String(repeating: "a", count: 64)
        XCTAssertNil(coordinator.evaluateForwardIfEnabled(envelope: envelope, relayDeviceIdHash: relayHash))
    }

    #if DEBUG
    func testMutationSkipTtlChangesOutcome() {
        let envelope = MeshRelayEnvelopeV2(
            protocolVersion: 2,
            messageId: "mut-swift-ttl",
            hopCount: 0,
            maxHops: 5,
            ttlHops: 0,
            copyCount: 1,
            maxCopyCount: 3,
            originCreatedAt: "2026-11-01T12:00:00Z",
            opaqueCiphertextBase64: "dGVzdA==",
            hopChainReceipt: HopChainReceiptV2()
        )
        let relayHash = String(repeating: "a", count: 64)
        let baseline = MeshRelayEngineFactory.createRelayEngine(lruCapacity: 8)
            .evaluateForward(envelope: envelope, relayDeviceIdHash: relayHash)
        XCTAssertEqual(baseline.dropReason, .ttlExceeded)

        let mutated = MeshRelayEngineTesting.create(
            MeshRelayEngineTesting.TestingConfig(lruCapacity: 8, skipTtlDecrement: true)
        ).evaluateForward(envelope: envelope, relayDeviceIdHash: relayHash)
        XCTAssertEqual(mutated.decision, .forward)
    }
    #endif

    private func decodeEnvelope(_ obj: [String: Any]) throws -> MeshRelayEnvelopeV2 {
        let receiptObj = obj["hopChainReceipt"] as? [String: Any] ?? [:]
        let hashes = receiptObj["relayDeviceIdHashes"] as? [String] ?? []
        return MeshRelayEnvelopeV2(
            protocolVersion: obj["protocolVersion"] as? Int ?? 2,
            messageId: obj["messageId"] as? String ?? "",
            hopCount: obj["hopCount"] as? Int ?? 0,
            maxHops: obj["maxHops"] as? Int ?? 5,
            ttlHops: obj["ttlHops"] as? Int ?? 0,
            copyCount: obj["copyCount"] as? Int ?? 1,
            maxCopyCount: obj["maxCopyCount"] as? Int ?? 3,
            originCreatedAt: obj["originCreatedAt"] as? String ?? "",
            opaqueCiphertextBase64: obj["opaqueCiphertextBase64"] as? String ?? "",
            hopChainReceipt: HopChainReceiptV2(relayDeviceIdHashes: hashes),
            peerAckHint: obj["peerAckHint"] as? String
        )
    }

    private func repoRoot() -> URL {
        let cwd = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        if FileManager.default.fileExists(atPath: cwd.appendingPathComponent("packages/contracts").path) {
            return cwd
        }
        return cwd.deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
    }
}

import XCTest
import Foundation
@testable import SOSMeshContracts

final class CanonicalJSONVectorTests: XCTestCase {
    private func parseFixtureInput(_ value: Any) throws -> Any {
        if value is NSNull || value is NSString || value is String || value is Bool || value is NSNumber {
            return value
        }
        if value is Int || value is Int64 || value is Double {
            return value
        }
        let wrapData = try JSONSerialization.data(withJSONObject: [value], options: [])
        guard var wrapped = String(data: wrapData, encoding: .utf8), wrapped.count >= 2 else {
            throw NSError(domain: "CanonicalJSONVectorTests", code: 1, userInfo: nil)
        }
        wrapped.removeFirst()
        wrapped.removeLast()
        let fragmentData = Data(wrapped.utf8)
        return try JSONSerialization.jsonObject(with: fragmentData, options: [.fragmentsAllowed])
    }

    func testBundledCanonicalJsonBytesMatchWorkspaceCopy() throws {
        let bundledURL = try BundledGolden.canonicalJson001URL()
        let workspaceCopy = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .appendingPathComponent("Resources/canonical-json-001.json")
        XCTAssertEqual(try Data(contentsOf: bundledURL), try Data(contentsOf: workspaceCopy))
    }

    func testCanonicalJson001MatchesFixture() throws {
        let cases = try BundledGolden.canonicalJson001Cases()

        for entry in cases {
            let name = try XCTUnwrap(entry["name"] as? String)
            let encodedInput = entry["input"] ?? NSNull()
            let logicalInput = try CanonicalJsonFixtureInput.decode(encodedInput)
            let parsed = try parseFixtureInput(logicalInput)
            let expected = try XCTUnwrap(entry["expected"] as? String)
            let encoded = try CanonicalJSON.encode(parsed)
            XCTAssertEqual(encoded, expected, "[\(name)] CanonicalJSON.encode mismatch")
        }
    }
}

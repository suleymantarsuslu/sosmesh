import XCTest
import Foundation
@testable import SOSMeshContracts

final class CanonicalJSONVectorTests: XCTestCase {
    func testBundledCanonicalJsonBytesMatchWorkspaceCopy() throws {
        let bundledURL = try BundledGolden.canonicalJson001URL()
        let workspaceCopy = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .appendingPathComponent("Resources/canonical-json-001.json")
        XCTAssertEqual(try Data(contentsOf: bundledURL), try Data(contentsOf: workspaceCopy))
    }

    func testCanonicalJson001MatchesFixture() throws {
        let cases = try BundledGolden.canonicalJson001Cases()
        let options: JSONSerialization.ReadingOptions = [.fragmentsAllowed]

        for entry in cases {
            let name = try XCTUnwrap(entry["name"] as? String)
            let inputAny = entry["input"] ?? NSNull()
            let inputData = try JSONSerialization.data(withJSONObject: inputAny, options: [])
            let parsed = try JSONSerialization.jsonObject(with: inputData, options: options)
            let expected = try XCTUnwrap(entry["expected"] as? String)
            let encoded = try CanonicalJSON.encode(parsed)
            XCTAssertEqual(encoded, expected, "[\(name)] CanonicalJSON.encode mismatch")
        }
    }
}

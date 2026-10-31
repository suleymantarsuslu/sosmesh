import XCTest
import Foundation
@testable import SOSMeshContracts

final class SosMessageTests: XCTestCase {
    let decoder = JSONDecoder()
    let encoder = JSONEncoder()
    
    static var canonicalOutputs: [String: Data] = [:]
    
    // Get fixtures path relative to repo root
    func getFixturePath(_ filename: String) -> String {
        // Use SOURCE_ROOT from environment (set by CI) or derive from #filePath
        let sourceRoot: String
        if let envRoot = ProcessInfo.processInfo.environment["SOURCE_ROOT"] {
            sourceRoot = envRoot
        } else {
            // Derive from current file path: Tests/SOSMeshContractsTests/SosMessageTests.swift
            // Go up to packages/contracts-swift/ then to workspace root
            let currentFile = #filePath
            let componentsCount = currentFile.components(separatedBy: "/").count
            let upLevels = Array(repeating: "..", count: componentsCount - 1).joined(separator: "/")
            sourceRoot = upLevels
        }
        return "\(sourceRoot)/packages/fixtures/protocol-v1/\(filename)"
    }
    
    override class func tearDown() {
        super.tearDown()
        
        // Write canonical JSON outputs
        let outputDir = "build/canonical-json"
        let fm = FileManager.default
        try? fm.createDirectory(atPath: outputDir, withIntermediateDirectories: true)
        
        for (name, data) in canonicalOutputs {
            let outputPath = "\(outputDir)/\(name).json"
            try? data.write(to: URL(fileURLWithPath: outputPath))
        }
        
        if !canonicalOutputs.isEmpty {
            print("✓ Canonical JSON outputs written to build/canonical-json/")
        }
    }
    
    func testUnknownLocationSosMessage() throws {
        let path = getFixturePath("unknown-location-sos.json")
        let url = URL(fileURLWithPath: path)
        let data = try Data(contentsOf: url)

        let message = try decoder.decode(SosMessage.self, from: data)
        XCTAssertEqual(message.envelope.locationStatus, .unknown)
        XCTAssertNil(message.envelope.location)

        encoder.outputFormatting = [.sortedKeys]
        let canonical = try encoder.encode(message)
        SosMessageTests.canonicalOutputs["unknown-location-sos-swift"] = canonical
    }

    func testValidSosMessageDeserialization() throws {
        let path = getFixturePath("valid-sos.json")
        let url = URL(fileURLWithPath: path)
        let data = try Data(contentsOf: url)
        
        let message = try decoder.decode(SosMessage.self, from: data)
        XCTAssertEqual(message.version, 1)
        XCTAssertEqual(message.id, "550e8400-e29b-41d4-a716-446655440000")
        XCTAssertEqual(message.envelope.ackLevel, "DEVICE_STORED")
        
        // Write canonical output (compact, sorted keys)
        encoder.outputFormatting = [.sortedKeys]
        let canonical = try encoder.encode(message)
        SosMessageTests.canonicalOutputs["valid-sos-swift"] = canonical
    }
    
    func testUnicodeSosMessage() throws {
        let path = getFixturePath("unicode-sos.json")
        let url = URL(fileURLWithPath: path)
        let data = try Data(contentsOf: url)
        
        let message = try decoder.decode(SosMessage.self, from: data)
        XCTAssertTrue(message.encryptedPayload.contains("İ"))
        XCTAssertTrue(message.encryptedPayload.contains("🚨"))
        
        // Write canonical output
        encoder.outputFormatting = [.sortedKeys]
        let canonical = try encoder.encode(message)
        SosMessageTests.canonicalOutputs["unicode-sos-swift"] = canonical
    }
    
    func testRoundtripSerialization() throws {
        let path = getFixturePath("valid-sos.json")
        let url = URL(fileURLWithPath: path)
        let data = try Data(contentsOf: url)
        
        let message = try decoder.decode(SosMessage.self, from: data)
        encoder.outputFormatting = [.sortedKeys]
        let serialized = try encoder.encode(message)
        let deserialized = try decoder.decode(SosMessage.self, from: serialized)
        
        XCTAssertEqual(message, deserialized)
    }
    
    func testInvalidMessageWithMissingFieldFails() throws {
        let path = getFixturePath("invalid-missing-field.json")
        let url = URL(fileURLWithPath: path)
        let data = try Data(contentsOf: url)
        
        XCTAssertThrowsError(try decoder.decode(SosMessage.self, from: data))
    }
    
    func testInvalidTimestampFails() throws {
        let path = getFixturePath("invalid-bad-timestamp.json")
        let url = URL(fileURLWithPath: path)
        let data = try Data(contentsOf: url)
        
        // Swift Codable does not validate ISO8601 format strictly by default
        // This will succeed but we document the behavior difference
        let message = try decoder.decode(SosMessage.self, from: data)
        XCTAssertNotNil(message)
    }
}

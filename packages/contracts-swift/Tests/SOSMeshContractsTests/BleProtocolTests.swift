import XCTest
@testable import SOSMeshContracts
import Foundation

final class BleProtocolTests: XCTestCase {
    
    private var testVectors: [String: Any]?
    
    override func setUp() async throws {
        // Use #filePath to get absolute path to this test file, then navigate to repo root
        let testFileURL = URL(fileURLWithPath: #filePath)
        // From Tests/SOSMeshContractsTests/BleProtocolTests.swift
        // Go up: BleProtocolTests.swift -> SOSMeshContractsTests -> Tests -> contracts-swift -> packages -> repo_root
        let repoRoot = testFileURL
            .deletingLastPathComponent()  // -> SOSMeshContractsTests/
            .deletingLastPathComponent()  // -> Tests/
            .deletingLastPathComponent()  // -> contracts-swift/
            .deletingLastPathComponent()  // -> packages/
            .deletingLastPathComponent()  // -> repo root
        
        let fixturesURL = repoRoot
            .appendingPathComponent("fixtures")
            .appendingPathComponent("ble")
            .appendingPathComponent("test-vectors.json")
        
        guard FileManager.default.fileExists(atPath: fixturesURL.path) else {
            throw NSError(domain: "TestError", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "test-vectors.json not found at: \(fixturesURL.path)"
            ])
        }
        
        let data = try Data(contentsOf: fixturesURL)
        guard let vectors = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw NSError(domain: "TestError", code: 2, userInfo: [
                NSLocalizedDescriptionKey: "Invalid test-vectors.json format"
            ])
        }
        
        testVectors = vectors
    }
    
    func testCRC32WithKnownInput() throws {
        guard let vectors = testVectors?["vectors"] as? [[String: Any]] else {
            XCTFail("Could not load test vectors")
            return
        }
        
        guard let crcVector = vectors.first(where: { 
            $0["name"] as? String == "CRC32 Known Input" 
        }) else {
            XCTFail("CRC32 test vector not found")
            return
        }
        
        let inputHex = crcVector["input_hex"] as! String
        let expectedCRC = UInt32(crcVector["expected_crc32"] as! Int)
        
        let input = Data(hex: inputHex)!
        let actualCRC = BleProtocol.calculateCRC32(input)
        
        XCTAssertEqual(actualCRC, expectedCRC, "CRC32 mismatch for 'Hello World'")
        print("✓ Swift CRC32 test passed: \(actualCRC)")
    }
    
    func testSHA256WithKnownInput() throws {
        guard let vectors = testVectors?["vectors"] as? [[String: Any]] else {
            XCTFail("Could not load test vectors")
            return
        }
        
        guard let shaVector = vectors.first(where: { 
            $0["name"] as? String == "SHA-256 Known Input" 
        }) else {
            XCTFail("SHA-256 test vector not found")
            return
        }
        
        let inputHex = shaVector["input_hex"] as! String
        let expectedSHA = shaVector["expected_sha256"] as! String
        
        let input = Data(hex: inputHex)!
        let actualSHA = BleProtocol.calculateSHA256(input)
        let actualSHAHex = actualSHA.hexString
        
        XCTAssertEqual(actualSHAHex, expectedSHA, "SHA-256 mismatch for 'Hello World'")
        print("✓ Swift SHA-256 test passed: \(actualSHAHex)")
    }
    
    func testChunkHeaderSerialization() {
        let header = BleProtocol.ChunkHeader(
            seq: 0,
            total: 5,
            crc32: 0x12345678,
            flags: 0x01
        )
        
        let serialized = BleProtocol.serializeChunkHeader(header)
        
        XCTAssertEqual(serialized.count, BleProtocol.chunkHeaderSize, "Header size mismatch")
        
        // Verify big-endian encoding
        XCTAssertEqual(serialized[0], 0x00, "seq high byte")
        XCTAssertEqual(serialized[1], 0x00, "seq low byte")
        XCTAssertEqual(serialized[2], 0x00, "total high byte")
        XCTAssertEqual(serialized[3], 0x05, "total low byte")
        
        print("✓ Swift chunk header serialization test passed")
    }
    
    func testChunkHeaderDeserialization() throws {
        let data = Data([
            0x00, 0x02, // seq = 2
            0x00, 0x0A, // total = 10
            0x12, 0x34, 0x56, 0x78, // crc32
            0x02, // flags (LAST_CHUNK)
            0x00, 0x00, 0x00 // reserved
        ])
        
        let header = try BleProtocol.deserializeChunkHeader(data)
        
        XCTAssertEqual(header.seq, 2)
        XCTAssertEqual(header.total, 10)
        XCTAssertEqual(header.crc32, 0x12345678)
        XCTAssertEqual(header.flags, 0x02)
        
        print("✓ Swift chunk header deserialization test passed")
    }
    
    func testChunkCRCVerification() {
        let payload = "TEST_PAYLOAD_NO_PII".data(using: .utf8)!
        let crc = BleProtocol.calculateCRC32(payload)
        
        let header = BleProtocol.ChunkHeader(
            seq: 0,
            total: 1,
            crc32: crc,
            flags: 0x03 // FIRST_CHUNK | LAST_CHUNK
        )
        
        XCTAssertTrue(BleProtocol.verifyChunkCRC(header: header, payload: payload), 
                     "CRC verification should pass")
        
        // Test with wrong CRC
        let wrongHeader = BleProtocol.ChunkHeader(
            seq: 0, total: 1, crc32: 0xDEADBEEF, flags: 0x03
        )
        XCTAssertFalse(BleProtocol.verifyChunkCRC(header: wrongHeader, payload: payload), 
                      "Wrong CRC should fail")
        
        print("✓ Swift chunk CRC verification test passed")
    }
    
    func testChunkHeaderRoundtrip() throws {
        let original = BleProtocol.ChunkHeader(
            seq: 42,
            total: 100,
            crc32: 0xABCDEF01,
            flags: 0x01
        )
        
        let serialized = BleProtocol.serializeChunkHeader(original)
        let deserialized = try BleProtocol.deserializeChunkHeader(serialized)
        
        XCTAssertEqual(original.seq, deserialized.seq)
        XCTAssertEqual(original.total, deserialized.total)
        XCTAssertEqual(original.crc32, deserialized.crc32)
        XCTAssertEqual(original.flags, deserialized.flags)
        
        print("✓ Swift chunk header roundtrip test passed")
    }
    
    func testNegativeCRCMismatchDetection() {
        let payload = "SYNTHETIC_TEST_DATA".data(using: .utf8)!
        let wrongCRC: UInt32 = 0x99999999
        
        let header = BleProtocol.ChunkHeader(
            seq: 0,
            total: 1,
            crc32: wrongCRC,
            flags: 0x03
        )
        
        XCTAssertFalse(
            BleProtocol.verifyChunkCRC(header: header, payload: payload),
            "CRC mismatch should be detected"
        )
        
        print("✓ Swift negative test (CRC mismatch) passed")
    }
}

// Helper extensions
extension Data {
    init?(hex: String) {
        let len = hex.count / 2
        var data = Data(capacity: len)
        for i in 0..<len {
            let j = hex.index(hex.startIndex, offsetBy: i*2)
            let k = hex.index(j, offsetBy: 2)
            let bytes = hex[j..<k]
            if let num = UInt8(bytes, radix: 16) {
                data.append(num)
            } else {
                return nil
            }
        }
        self = data
    }
    
    var hexString: String {
        map { String(format: "%02x", $0) }.joined()
    }
}

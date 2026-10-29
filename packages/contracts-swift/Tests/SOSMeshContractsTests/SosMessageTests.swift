import XCTest
@testable import SOSMeshContracts

final class SosMessageTests: XCTestCase {
    let decoder = JSONDecoder()
    let encoder = JSONEncoder()
    
    func testValidSosMessageDeserialization() throws {
        let fixturesPath = "../../fixtures/protocol-v1"
        let url = URL(fileURLWithPath: "\(fixturesPath)/valid-sos.json")
        let data = try Data(contentsOf: url)
        
        let message = try decoder.decode(SosMessage.self, from: data)
        XCTAssertEqual(message.version, 1)
        XCTAssertEqual(message.id, "550e8400-e29b-41d4-a716-446655440000")
        XCTAssertEqual(message.envelope.ackLevel, "DEVICE_STORED")
    }
    
    func testUnicodeSosMessage() throws {
        let fixturesPath = "../../fixtures/protocol-v1"
        let url = URL(fileURLWithPath: "\(fixturesPath)/unicode-sos.json")
        let data = try Data(contentsOf: url)
        
        let message = try decoder.decode(SosMessage.self, from: data)
        XCTAssertTrue(message.encryptedPayload.contains("İ"))
        XCTAssertTrue(message.encryptedPayload.contains("🚨"))
    }
    
    func testRoundtripSerialization() throws {
        let fixturesPath = "../../fixtures/protocol-v1"
        let url = URL(fileURLWithPath: "\(fixturesPath)/valid-sos.json")
        let data = try Data(contentsOf: url)
        
        let message = try decoder.decode(SosMessage.self, from: data)
        encoder.outputFormatting = [.sortedKeys, .prettyPrinted]
        let serialized = try encoder.encode(message)
        let deserialized = try decoder.decode(SosMessage.self, from: serialized)
        
        XCTAssertEqual(message, deserialized)
    }
    
    func testInvalidMessageWithMissingFieldFails() throws {
        let fixturesPath = "../../fixtures/protocol-v1"
        let url = URL(fileURLWithPath: "\(fixturesPath)/invalid-missing-field.json")
        let data = try Data(contentsOf: url)
        
        XCTAssertThrowsError(try decoder.decode(SosMessage.self, from: data))
    }
}

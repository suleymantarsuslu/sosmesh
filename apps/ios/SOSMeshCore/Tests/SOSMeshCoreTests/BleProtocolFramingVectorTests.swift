import XCTest
@testable import SOSMeshCore

final class BleProtocolFramingVectorTests: XCTestCase {
    func testHandshakeChunkSizeMatchesFixture() throws {
        let url = fixtureURL()
        let data = try Data(contentsOf: url)
        let root = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        let vectors = try XCTUnwrap(root["vectors"] as? [[String: Any]])
        let handshake = try XCTUnwrap(vectors.first { ($0["name"] as? String) == "Handshake Sequence" })
        let hello = try XCTUnwrap(handshake["hello"] as? [String: Any])
        let mtu = try XCTUnwrap(hello["mtu"] as? Int)
        let expectedChunkSize = try XCTUnwrap(handshake["expected_chunk_size"] as? Int)
        let computed =
            mtu - BleTransferProtocolConstants.attOverhead - BleTransferProtocolConstants.chunkHeaderSize
        XCTAssertEqual(computed, expectedChunkSize)
    }

    func testHelloAckEmittedForValidHello() {
        var ackWire: Data?
        let receiverSide = GattBleTransferTransport(
            outbound: CaptureWriter { _, value in ackWire = value }
        )
        let receiver = BleTransferReceiver(transport: receiverSide, config: BleTransferConfig())
        var hello = Data(count: 20)
        hello[0] = BleTransferMessageType.hello.rawValue
        hello[1] = UInt8(BleTransferProtocolConstants.protocolVersion)
        hello.replaceSubrange(2 ..< 18, with: Data(repeating: 0x01, count: 16))
        hello[18] = UInt8((247 >> 8) & 0xff)
        hello[19] = UInt8(247 & 0xff)
        receiverSide.deliverIncoming(uuid: BleMeshConstants.controlCharacteristicUUID, value: hello)
        XCTAssertNotNil(ackWire)
        XCTAssertEqual(ackWire?.first, BleTransferMessageType.helloAck.rawValue)
        XCTAssertEqual(ackWire?.count, 21)
        XCTAssertEqual(receiver.getState(), .ready)
    }

    private func fixtureURL() -> URL {
        if let envRoot = ProcessInfo.processInfo.environment["SOURCE_ROOT"] {
            return URL(fileURLWithPath: envRoot)
                .appendingPathComponent("packages/fixtures/ble/test-vectors.json")
        }
        var url = URL(fileURLWithPath: #filePath)
        for _ in 0 ..< 5 { url.deleteLastPathComponent() }
        return url
            .appendingPathComponent("packages/fixtures/ble/test-vectors.json")
    }
}

private final class CaptureWriter: GattOutboundWriting {
    let handler: (String, Data) -> Void
    init(_ handler: @escaping (String, Data) -> Void) { self.handler = handler }
    func writeCharacteristic(uuid: String, value: Data) { handler(uuid, value) }
}

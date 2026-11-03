import XCTest
@testable import SOSMeshCore

final class BleIncomingPayloadRouterTests: XCTestCase {
    func testGarbagePayloadIsNotStored() {
        let inbox = ReceivedSosInbox()
        let router = BleIncomingPayloadRouter(inbox: inbox, nowMs: { 1 })
        router.onCompleted(payload: Data("not-json".utf8))
        XCTAssertTrue(inbox.list().isEmpty)
    }

    func testOpaqueJsonWithoutMessageIdIsNotStored() {
        let inbox = ReceivedSosInbox()
        let router = BleIncomingPayloadRouter(inbox: inbox, nowMs: { 1 })
        router.onCompleted(payload: Data("{\"encrypted\":\"opaque\"}".utf8))
        XCTAssertTrue(inbox.list().isEmpty)
    }

    func testRandomBinaryPayloadIsNotStored() {
        let inbox = ReceivedSosInbox()
        let router = BleIncomingPayloadRouter(inbox: inbox, nowMs: { 1 })
        router.onCompleted(payload: Data([0x00, 0x01, 0xFE, 0xFF]))
        XCTAssertTrue(inbox.list().isEmpty)
    }
}

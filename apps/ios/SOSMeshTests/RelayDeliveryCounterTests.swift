import XCTest
@testable import SOSMesh

final class RelayDeliveryCounterTests: XCTestCase {
    var counter: RelayDeliveryCounter!
    var defaults: UserDefaults!
    
    override func setUp() {
        super.setUp()
        defaults = UserDefaults(suiteName: "test.relaycounter")
        defaults.removePersistentDomain(forName: "test.relaycounter")
        counter = RelayDeliveryCounter(defaults: defaults)
        for id in ["msg-1", "msg-2", "msg-3"] {
            counter.recordCarriedMessage(messageId: id)
        }
    }
    
    override func tearDown() {
        defaults.removePersistentDomain(forName: "test.relaycounter")
        super.tearDown()
    }
    
    func testRecordsDeliveredMessages() {
        XCTAssertEqual(counter.deliveredCount(), 0)
        
        counter.recordDelivered(messageId: "msg-1")
        XCTAssertEqual(counter.deliveredCount(), 1)
        
        counter.recordDelivered(messageId: "msg-2")
        XCTAssertEqual(counter.deliveredCount(), 2)
    }
    
    func testDeduplicatesByMessageId() {
        counter.recordDelivered(messageId: "msg-1")
        XCTAssertEqual(counter.deliveredCount(), 1)
        
        counter.recordDelivered(messageId: "msg-1")
        XCTAssertEqual(counter.deliveredCount(), 1)
        
        counter.recordDelivered(messageId: "msg-2")
        XCTAssertEqual(counter.deliveredCount(), 2)
    }
    
    func testPersistsAcrossRestarts() {
        counter.recordDelivered(messageId: "msg-1")
        counter.recordDelivered(messageId: "msg-2")
        XCTAssertEqual(counter.deliveredCount(), 2)
        
        let newCounter = RelayDeliveryCounter(defaults: defaults)
        XCTAssertEqual(newCounter.deliveredCount(), 2)
        
        newCounter.recordDelivered(messageId: "msg-3")
        XCTAssertEqual(newCounter.deliveredCount(), 3)
    }

    func testOwnMessagesNeverCount() {
        counter.recordDelivered(messageId: "own-1")
        counter.markCarriedMessagesDelivered(["own-2"])
        XCTAssertEqual(counter.deliveredCount(), 0)

        counter.recordDelivered(messageId: "msg-1")
        XCTAssertEqual(counter.deliveredCount(), 1)
    }
}

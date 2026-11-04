import XCTest
@testable import SOSMeshCore

final class PeerFanoutDeliveryTests: XCTestCase {
    func testFanout_threePeers_oneFailure_otherTwoReceive() async {
        let store = PeerDeliveryRecordStore()
        let sosId = "sos-1"
        
        let allPeers: Set<String> = ["peer-a", "peer-b", "peer-c"]
        
        XCTAssertFalse(await store.hasDeliveredToAll(sosId: sosId, allDiscoveredPeerIds: allPeers))
        
        await store.recordDelivery(sosId: sosId, peerId: "peer-a")
        XCTAssertFalse(await store.hasDeliveredToAll(sosId: sosId, allDiscoveredPeerIds: allPeers))
        XCTAssertEqual(await store.getDeliveredPeers(sosId: sosId), ["peer-a"])
        
        await store.recordDelivery(sosId: sosId, peerId: "peer-c")
        XCTAssertFalse(await store.hasDeliveredToAll(sosId: sosId, allDiscoveredPeerIds: allPeers))
        XCTAssertEqual(await store.getDeliveredPeers(sosId: sosId), ["peer-a", "peer-c"])
        
        await store.recordDelivery(sosId: sosId, peerId: "peer-b")
        XCTAssertTrue(await store.hasDeliveredToAll(sosId: sosId, allDiscoveredPeerIds: allPeers))
        XCTAssertEqual(await store.getDeliveredPeers(sosId: sosId), ["peer-a", "peer-b", "peer-c"])
    }
    
    func testFanout_emptyPeerSet_consideredComplete() async {
        let store = PeerDeliveryRecordStore()
        let sosId = "sos-empty"
        
        XCTAssertTrue(await store.hasDeliveredToAll(sosId: sosId, allDiscoveredPeerIds: []))
    }
    
    func testFanout_newPeerDiscovered_fanoutContinues() async {
        let store = PeerDeliveryRecordStore()
        let sosId = "sos-2"
        
        let initialPeers: Set<String> = ["peer-a", "peer-b"]
        await store.recordDelivery(sosId: sosId, peerId: "peer-a")
        await store.recordDelivery(sosId: sosId, peerId: "peer-b")
        
        XCTAssertTrue(await store.hasDeliveredToAll(sosId: sosId, allDiscoveredPeerIds: initialPeers))
        
        let extendedPeers: Set<String> = ["peer-a", "peer-b", "peer-c"]
        XCTAssertFalse(await store.hasDeliveredToAll(sosId: sosId, allDiscoveredPeerIds: extendedPeers))
        
        await store.recordDelivery(sosId: sosId, peerId: "peer-c")
        XCTAssertTrue(await store.hasDeliveredToAll(sosId: sosId, allDiscoveredPeerIds: extendedPeers))
    }
    
    func testFanout_multipleMessages_trackedIndependently() async {
        let store = PeerDeliveryRecordStore()
        let sos1 = "sos-1"
        let sos2 = "sos-2"
        let allPeers: Set<String> = ["peer-a", "peer-b"]
        
        await store.recordDelivery(sosId: sos1, peerId: "peer-a")
        await store.recordDelivery(sosId: sos2, peerId: "peer-a")
        await store.recordDelivery(sosId: sos2, peerId: "peer-b")
        
        XCTAssertFalse(await store.hasDeliveredToAll(sosId: sos1, allDiscoveredPeerIds: allPeers))
        XCTAssertTrue(await store.hasDeliveredToAll(sosId: sos2, allDiscoveredPeerIds: allPeers))
        
        await store.recordDelivery(sosId: sos1, peerId: "peer-b")
        XCTAssertTrue(await store.hasDeliveredToAll(sosId: sos1, allDiscoveredPeerIds: allPeers))
    }
    
    func testFanout_clearRecords_resetsState() async {
        let store = PeerDeliveryRecordStore()
        let sosId = "sos-clear"
        let allPeers: Set<String> = ["peer-a", "peer-b"]
        
        await store.recordDelivery(sosId: sosId, peerId: "peer-a")
        await store.recordDelivery(sosId: sosId, peerId: "peer-b")
        XCTAssertTrue(await store.hasDeliveredToAll(sosId: sosId, allDiscoveredPeerIds: allPeers))
        
        await store.clearMessageRecords(sosId: sosId)
        XCTAssertEqual(await store.getDeliveredPeers(sosId: sosId), [])
        XCTAssertFalse(await store.hasDeliveredToAll(sosId: sosId, allDiscoveredPeerIds: allPeers))
    }
    
    func testFanout_duplicateDelivery_idempotent() async {
        let store = PeerDeliveryRecordStore()
        let sosId = "sos-dup"
        
        await store.recordDelivery(sosId: sosId, peerId: "peer-a")
        await store.recordDelivery(sosId: sosId, peerId: "peer-a")
        await store.recordDelivery(sosId: sosId, peerId: "peer-a")
        
        XCTAssertEqual(await store.getDeliveredPeers(sosId: sosId), ["peer-a"])
    }
}

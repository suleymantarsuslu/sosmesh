import XCTest
@testable import SOSMeshCore

final class AttachmentUploadCoordinatorTests: XCTestCase {
    var tempDir: URL!
    var queue: AttachmentQueue!
    
    override func setUp() async throws {
        try await super.setUp()
        tempDir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
        queue = try AttachmentQueue(baseDir: tempDir)
    }
    
    override func tearDown() async throws {
        try? FileManager.default.removeItem(at: tempDir)
        try await super.tearDown()
    }
    
    func testCoordinatorStartsUploadWithoutPriorPathUpdate() async throws {
        let testData = Data("test image".utf8)
        let attachment = try queue.enqueue(
            sosMessageId: "sos-123",
            uploadToken: "mock-token",
            kind: .image,
            data: testData,
            mimeType: "image/jpeg"
        )
        
        let coordinator = AttachmentUploadCoordinator(queue: queue, baseURL: "http://localhost:9999")
        
        var statusUpdates: [(String, AttachmentUploadStatus)] = []
        coordinator.onStatusChange = { id, status in
            statusUpdates.append((id, status))
        }
        
        await coordinator.processSosAttachments(sosId: "sos-123")
        
        XCTAssertFalse(statusUpdates.isEmpty, "Coordinator should attempt upload without waiting for path update")
        
        let uploadingStatus = statusUpdates.first { update in
            if case .uploading = update.1 {
                return true
            }
            return false
        }
        XCTAssertNotNil(uploadingStatus, "Should transition to uploading state")
    }
    
    func testCoordinatorRetriesPendingOnLaunch() async throws {
        let testData = Data("test audio".utf8)
        let attachment = try queue.enqueue(
            sosMessageId: "sos-456",
            uploadToken: "mock-token-2",
            kind: .audio,
            data: testData,
            mimeType: "audio/aac"
        )
        
        let coordinator = AttachmentUploadCoordinator(queue: queue, baseURL: "http://localhost:9999")
        
        var attemptedUploads: [String] = []
        coordinator.onStatusChange = { id, status in
            if case .uploading = status {
                attemptedUploads.append(id)
            }
        }
        
        coordinator.start()
        
        try await Task.sleep(nanoseconds: 1_000_000_000)
        
        await coordinator.processQueue()
        
        XCTAssertTrue(attemptedUploads.contains(attachment.id), "Should retry pending uploads on launch")
    }
    
    func testCoordinatorValidatesAudioSizeLimit() async throws {
        let oversizedData = Data(repeating: 0, count: 51 * 1024 * 1024)
        let attachment = try queue.enqueue(
            sosMessageId: "sos-789",
            uploadToken: "mock-token-3",
            kind: .audio,
            data: oversizedData,
            mimeType: "audio/aac"
        )
        
        let coordinator = AttachmentUploadCoordinator(queue: queue, baseURL: "http://localhost:9999")
        
        var failedWithSizeError = false
        coordinator.onStatusChange = { id, status in
            if case .failed(let error as NSError) = status {
                failedWithSizeError = error.code == 413
            }
        }
        
        await coordinator.processSosAttachments(sosId: "sos-789")
        
        try await Task.sleep(nanoseconds: 500_000_000)
        
        XCTAssertTrue(failedWithSizeError, "Should reject audio files larger than 50 MB")
        
        let remaining = queue.listPending()
        XCTAssertTrue(remaining.isEmpty, "Oversized attachment should be removed from queue")
    }
    
    func testCoordinatorValidatesImageSizeLimit() async throws {
        let oversizedData = Data(repeating: 0, count: 16 * 1024 * 1024)
        let attachment = try queue.enqueue(
            sosMessageId: "sos-101",
            uploadToken: "mock-token-4",
            kind: .image,
            data: oversizedData,
            mimeType: "image/jpeg"
        )
        
        let coordinator = AttachmentUploadCoordinator(queue: queue, baseURL: "http://localhost:9999")
        
        var failedWithSizeError = false
        coordinator.onStatusChange = { id, status in
            if case .failed(let error as NSError) = status {
                failedWithSizeError = error.code == 413
            }
        }
        
        await coordinator.processSosAttachments(sosId: "sos-101")
        
        try await Task.sleep(nanoseconds: 500_000_000)
        
        XCTAssertTrue(failedWithSizeError, "Should reject image files larger than 15 MB")
        
        let remaining = queue.listPending()
        XCTAssertTrue(remaining.isEmpty, "Oversized attachment should be removed from queue")
    }
    
    func testCoordinatorDoesNotUploadWithoutToken() async throws {
        let testData = Data("test no token".utf8)
        let attachment = try queue.enqueue(
            sosMessageId: "sos-202",
            uploadToken: nil,
            kind: .image,
            data: testData,
            mimeType: "image/png"
        )
        
        let coordinator = AttachmentUploadCoordinator(queue: queue, baseURL: "http://localhost:9999")
        
        var statusUpdates: [AttachmentUploadStatus] = []
        coordinator.onStatusChange = { _, status in
            statusUpdates.append(status)
        }
        
        await coordinator.processSosAttachments(sosId: "sos-202")
        
        XCTAssertTrue(statusUpdates.isEmpty, "Should not attempt upload without uploadToken")
        
        let remaining = queue.listPending()
        XCTAssertEqual(remaining.count, 1, "Attachment without token should remain in queue")
    }
    
    func testAttachmentUploadAfterLateTokenArrival() async throws {
        let testData = Data("test late token".utf8)
        let attachment = try queue.enqueue(
            sosMessageId: "sos-303",
            uploadToken: nil,
            kind: .image,
            data: testData,
            mimeType: "image/jpeg"
        )
        
        let coordinator = AttachmentUploadCoordinator(queue: queue, baseURL: "http://localhost:9999")
        
        var statusUpdates: [AttachmentUploadStatus] = []
        coordinator.onStatusChange = { _, status in
            statusUpdates.append(status)
        }
        
        await coordinator.processSosAttachments(sosId: "sos-303")
        XCTAssertTrue(statusUpdates.isEmpty, "Should not attempt upload without token initially")
        
        try queue.setUploadToken("late-token", forSosId: "sos-303")
        
        await coordinator.processSosAttachments(sosId: "sos-303")
        
        let uploadingStatus = statusUpdates.first { status in
            if case .uploading = status {
                return true
            }
            return false
        }
        XCTAssertNotNil(uploadingStatus, "Should attempt upload after token is set")
    }
}

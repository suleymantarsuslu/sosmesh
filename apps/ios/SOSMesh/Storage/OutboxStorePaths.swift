import Foundation

enum OutboxStorePaths {
    static func applicationSupportOutboxFileURL() throws -> URL {
        let fileManager = FileManager.default
        guard let base = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            throw NSError(domain: "OutboxStorePaths", code: 1, userInfo: nil)
        }
        let directory = base.appendingPathComponent("SOSMesh", isDirectory: true)
        try fileManager.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [
            FileAttributeKey.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication,
        ])
        var directoryValues = URLResourceValues()
        directoryValues.isExcludedFromBackup = true
        var directoryURL = directory
        try directoryURL.setResourceValues(directoryValues)

        let fileURL = directory.appendingPathComponent("outbox.json")
        if !fileManager.fileExists(atPath: fileURL.path) {
            fileManager.createFile(atPath: fileURL.path, contents: Data())
        }
        try fileManager.setAttributes(
            [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
            ofItemAtPath: fileURL.path
        )
        var fileValues = URLResourceValues()
        fileValues.isExcludedFromBackup = true
        var mutableFileURL = fileURL
        try mutableFileURL.setResourceValues(fileValues)
        return fileURL
    }
}

import Foundation

enum BundledGolden {
    /// Loads `golden-001.json` from the test target resource bundle (see Package.swift `resources:`).
    static func golden001URL() throws -> URL {
        if let url = Bundle.module.url(forResource: "golden-001", withExtension: "json", subdirectory: "Resources") {
            return url
        }
        if let url = Bundle.module.url(forResource: "golden-001", withExtension: "json") {
            return url
        }
        let listing: String
        if let resourceURL = Bundle.module.resourceURL,
           let names = try? FileManager.default.contentsOfDirectory(atPath: resourceURL.path) {
            listing = names.sorted().joined(separator: ", ")
        } else {
            listing = "(no Bundle.module.resourceURL)"
        }
        throw NSError(
            domain: "BundledGolden",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: "golden-001.json missing from Bundle.module; resource listing: \(listing)"]
        )
    }

    static func golden001Dictionary() throws -> [String: Any] {
        let url = try golden001URL()
        let data = try Data(contentsOf: url)
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw NSError(
                domain: "BundledGolden",
                code: 2,
                userInfo: [NSLocalizedDescriptionKey: "golden-001.json is not a JSON object"]
            )
        }
        return json
    }
}

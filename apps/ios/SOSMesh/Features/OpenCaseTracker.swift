import Foundation

struct OpenCase: Codable {
    let sosId: String
    let openedAtMs: Int64
}

final class OpenCaseTracker {
    private let defaults: UserDefaults
    private let key = "sosmesh.open_case"
    private let caseTimeoutMs: Int64 = 24 * 60 * 60 * 1000
    
    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }
    
    func openCase(sosId: String, nowMs: Int64) {
        let openCase = OpenCase(sosId: sosId, openedAtMs: nowMs)
        if let data = try? JSONEncoder().encode(openCase) {
            defaults.set(data, forKey: key)
        }
    }
    
    func currentOpenCase(nowMs: Int64) -> OpenCase? {
        guard let data = defaults.data(forKey: key),
              let openCase = try? JSONDecoder().decode(OpenCase.self, from: data) else {
            return nil
        }
        
        if nowMs - openCase.openedAtMs > caseTimeoutMs {
            clearCase()
            return nil
        }
        
        return openCase
    }
    
    func clearCase() {
        defaults.removeObject(forKey: key)
    }
    
    func hasOpenCase(nowMs: Int64) -> Bool {
        currentOpenCase(nowMs: nowMs) != nil
    }
}

import Foundation
import Security

/// Optional onboarding profile (§7). Stored only in the Keychain; leaves the device only inside
/// the encrypted inner SOS payload. Every field is optional.
public struct SosProfile: Codable, Equatable, Sendable {
    public struct Address: Codable, Equatable, Sendable {
        public var line: String?
        public var district: String?
        public var city: String?
        public var postalCode: String?
        public var country: String?

        public init(line: String? = nil, district: String? = nil, city: String? = nil, postalCode: String? = nil, country: String? = nil) {
            self.line = line
            self.district = district
            self.city = city
            self.postalCode = postalCode
            self.country = country
        }

        public var isEmpty: Bool { [line, district, city, postalCode, country].allSatisfy { ($0 ?? "").isEmpty } }
    }

    public struct Coordinate: Codable, Equatable, Sendable {
        public var latitude: Double
        public var longitude: Double

        public init(latitude: Double, longitude: Double) {
            self.latitude = latitude
            self.longitude = longitude
        }
    }

    public var fullName: String?
    public var age: Int?
    public var address: Address?
    public var floor: Int?
    public var homeLocation: Coordinate?
    public var phone: String?
    public var email: String?
    public var householdSize: Int?

    public init(fullName: String? = nil, age: Int? = nil, address: Address? = nil, floor: Int? = nil, homeLocation: Coordinate? = nil, phone: String? = nil, email: String? = nil, householdSize: Int? = nil) {
        self.fullName = fullName
        self.age = age
        self.address = address
        self.floor = floor
        self.homeLocation = homeLocation
        self.phone = phone
        self.email = email
        self.householdSize = householdSize
    }

    public var isEmpty: Bool { self.sanitized() == SosProfile() }

    /// Applies the schema limits (sos-inner-payload-v2.schema.json); invalid values are dropped.
    public func sanitized() -> SosProfile {
        func text(_ value: String?, _ max: Int) -> String? {
            guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else { return nil }
            return String(trimmed.prefix(max))
        }
        var out = SosProfile()
        out.fullName = text(fullName, 100)
        out.age = age.flatMap { (0 ... 130).contains($0) ? $0 : nil }
        if let address {
            var a = Address(line: text(address.line, 300), district: text(address.district, 80), city: text(address.city, 80), postalCode: text(address.postalCode, 16), country: text(address.country, 2)?.uppercased())
            if let c = a.country, c.count != 2 || !c.allSatisfy({ $0.isASCII && $0.isLetter }) { a.country = nil }
            out.address = a.isEmpty ? nil : a
        }
        out.floor = floor.flatMap { (-10 ... 200).contains($0) ? $0 : nil }
        out.homeLocation = homeLocation.flatMap { (-90 ... 90).contains($0.latitude) && (-180 ... 180).contains($0.longitude) ? $0 : nil }
        if let p = text(phone, 32) {
            let normalized = p.filter { $0 == "+" || $0.isNumber }
            out.phone = SosProfile.isE164(normalized) ? normalized : nil
        }
        if let e = text(email, 254), e.contains("@"), !e.contains(" ") { out.email = e }
        out.householdSize = householdSize.flatMap { (1 ... 50).contains($0) ? $0 : nil }
        return out
    }

    public static func isE164(_ value: String) -> Bool {
        value.range(of: "^\\+[1-9][0-9]{6,14}$", options: .regularExpression) != nil
    }
}

/// Generic-password Keychain item, this device only, not backed up.
public final class KeychainSecureStore: @unchecked Sendable {
    private let service: String

    public init(service: String = "com.sosmesh.secure") {
        self.service = service
    }

    public func read(_ account: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess else { return nil }
        return result as? Data
    }

    @discardableResult
    public func write(_ data: Data, account: String) -> Bool {
        let base: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        if SecItemUpdate(base as CFDictionary, attributes as CFDictionary) == errSecSuccess { return true }
        var add = base
        attributes.forEach { add[$0.key] = $0.value }
        return SecItemAdd(add as CFDictionary, nil) == errSecSuccess
    }

    public func delete(_ account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}

/// Profile + stable sender key + sequence counter, all in the Keychain.
public final class SosIdentityStore: @unchecked Sendable {
    private let keychain: KeychainSecureStore
    private let lock = NSLock()
    static let profileAccount = "sosmesh.profile.v1"
    static let senderKeyAccount = "sosmesh.senderKey.v1"
    static let seqAccount = "sosmesh.senderSeq.v1"
    static let sentProfileHashAccount = "sosmesh.profileSentHash.v1"

    public init(keychain: KeychainSecureStore = KeychainSecureStore()) {
        self.keychain = keychain
    }

    public func loadProfile() -> SosProfile? {
        guard let data = keychain.read(Self.profileAccount) else { return nil }
        return try? JSONDecoder().decode(SosProfile.self, from: data)
    }

    @discardableResult
    public func saveProfile(_ profile: SosProfile) -> Bool {
        let clean = profile.sanitized()
        guard let data = try? JSONEncoder().encode(clean) else { return false }
        return keychain.write(data, account: Self.profileAccount)
    }

    public func deleteProfile() {
        keychain.delete(Self.profileAccount)
        keychain.delete(Self.sentProfileHashAccount)
    }

    /// 32 random bytes, hex; created once per install.
    public func senderKey() -> String {
        lock.lock(); defer { lock.unlock() }
        if let data = keychain.read(Self.senderKeyAccount), let key = String(data: data, encoding: .utf8),
           key.count == 64, key.allSatisfy({ $0.isHexDigit && !$0.isUppercase }) {
            return key
        }
        var bytes = [UInt8](repeating: 0, count: 32)
        if SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) != errSecSuccess {
            for i in bytes.indices { bytes[i] = UInt8.random(in: 0 ... 255) }
        }
        let key = bytes.map { String(format: "%02x", $0) }.joined()
        keychain.write(Data(key.utf8), account: Self.senderKeyAccount)
        return key
    }

    public func nextSeq() -> UInt32 {
        lock.lock(); defer { lock.unlock() }
        let current = keychain.read(Self.seqAccount).flatMap { String(data: $0, encoding: .utf8) }.flatMap { UInt32($0) } ?? 0
        let next = current == UInt32.max ? 1 : current + 1
        keychain.write(Data(String(next).utf8), account: Self.seqAccount)
        return next
    }

    /// True when the profile differs from the one in the last delivered SOS.
    public func profileChanged(_ profile: SosProfile) -> Bool {
        guard let data = try? JSONEncoder().encode(profile.sanitized()) else { return true }
        let hash = MeshV2.sha256Hex(data)
        return keychain.read(Self.sentProfileHashAccount).flatMap { String(data: $0, encoding: .utf8) } != hash
    }

    public func markProfileSent(_ profile: SosProfile) {
        guard let data = try? JSONEncoder().encode(profile.sanitized()) else { return }
        keychain.write(Data(MeshV2.sha256Hex(data).utf8), account: Self.sentProfileHashAccount)
    }
}

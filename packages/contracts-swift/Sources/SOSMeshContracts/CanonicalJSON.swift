import Foundation

/// Canonical JSON for crypto AAD (matches `packages/contracts/src/crypto.ts` `createAAD` + `JSON.stringify`).
enum CanonicalJSON {
    static func encode(_ obj: Any) throws -> String {
        try toCanonicalJSON(obj)
    }

    static func encodeAAD(envelope: [String: Any], keyId: String, protocolVersion: String) throws -> Data {
        guard let aadObject = sortKeys([
            "envelope": envelope,
            "keyId": keyId,
            "protocol": protocolVersion,
        ]) as? [String: Any] else {
            throw CryptoError.encryptionFailed
        }
        let canonicalJSON = try toCanonicalJSON(aadObject)
        guard let data = canonicalJSON.data(using: .utf8) else {
            throw CryptoError.encryptionFailed
        }
        return data
    }

    static func sortKeys(_ obj: Any) -> Any {
        if let dict = obj as? [String: Any] {
            var sorted = [String: Any]()
            for key in dict.keys.sorted() {
                sorted[key] = sortKeys(dict[key]!)
            }
            return sorted
        }
        if let array = obj as? [Any] {
            return array.map { sortKeys($0) }
        }
        return obj
    }

    private static func toCanonicalJSON(_ obj: Any) throws -> String {
        switch obj {
        case is NSNull:
            return "null"
        case let value as String:
            let escaped = value
                .replacingOccurrences(of: "\\", with: "\\\\")
                .replacingOccurrences(of: "\"", with: "\\\"")
            return "\"\(escaped)\""
        case let value as NSNumber:
            if CFGetTypeID(value) == CFBooleanGetTypeID() {
                return value.boolValue ? "true" : "false"
            }
            let doubleValue = value.doubleValue
            if doubleValue.rounded() == doubleValue,
               abs(doubleValue) <= Double(Int64.max) {
                return String(Int64(doubleValue))
            }
            return formatJSONNumber(doubleValue)
        case let value as Bool:
            return value ? "true" : "false"
        case let value as Int:
            return String(value)
        case let value as Int64:
            return String(value)
        case let value as Double:
            return formatJSONNumber(value)
        case let dict as [String: Any]:
            let parts = try dict.keys.sorted().map { key in
                let encoded = try toCanonicalJSON(dict[key]!)
                return "\"\(key)\":\(encoded)"
            }
            return "{\(parts.joined(separator: ","))}"
        case let array as [Any]:
            let parts = try array.map { try toCanonicalJSON($0) }
            return "[\(parts.joined(separator: ","))]"
        default:
            throw CryptoError.invalidInput("Unsupported JSON type for canonical encoding")
        }
    }

    private static func formatJSONNumber(_ value: Double) -> String {
        if value.isNaN || value.isInfinite {
            return "null"
        }
        if value.rounded() == value, abs(value) <= Double(Int64.max) {
            return String(Int64(value))
        }
        var text = String(value)
        if text.contains("e") || text.contains("E") {
            text = String(format: "%.15g", value)
        }
        return text
    }
}

import Foundation

/// Independent oracle mirroring `packages/contracts/src/crypto.ts` (`createAAD`, `sortKeys`, `JSON.stringify`).
/// Used only in tests — must stay aligned with the TypeScript reference, not with production Swift by assumption.
enum TypeScriptCryptoReference {
    private static let protocolVersion = "v1"

    static func createAADUTF8(envelope: [String: Any], keyId: String) -> String {
        let aadObject = sortKeys([
            "envelope": envelope,
            "keyId": keyId,
            "protocol": protocolVersion,
        ]) as! [String: Any]
        return jsonStringify(aadObject)
    }

    private static func sortKeys(_ obj: Any) -> Any {
        if obj is NSNull {
            return obj
        }
        if let dict = obj as? [String: Any] {
            var sorted: [String: Any] = [:]
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

    /// Minimal `JSON.stringify` for golden-001 envelope shapes (objects, arrays, string, number, boolean, null).
    private static func jsonStringify(_ obj: Any) -> String {
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
            if value.doubleValue.rounded() == value.doubleValue,
               abs(value.doubleValue) <= Double(Int64.max) {
                return String(Int64(value.doubleValue))
            }
            return String(value.doubleValue)
        case let value as Bool:
            return value ? "true" : "false"
        case let value as Int:
            return String(value)
        case let value as Double:
            return String(value)
        case let dict as [String: Any]:
            let parts = dict.keys.sorted().map { key in
                "\"\(key)\":\(jsonStringify(dict[key]!))"
            }
            return "{\(parts.joined(separator: ","))}"
        case let array as [Any]:
            return "[\(array.map { jsonStringify($0) }.joined(separator: ","))]"
        default:
            preconditionFailure("TypeScriptCryptoReference: unsupported type \(type(of: obj))")
        }
    }
}

import Foundation

/// Canonical JSON for crypto AAD (matches `packages/contracts` `canonicalJSON` / `JSON.stringify(sortKeys(...))`).
///
/// SOSMesh envelope objects use string keys only (never integer-like keys such as `"1"` or `"10"`);
/// JavaScript would enumerate those in numeric order, which we intentionally do not support.
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
            for key in dict.keys.sorted(by: utf16Sort) {
                sorted[key] = sortKeys(dict[key]!)
            }
            return sorted
        }
        if let array = obj as? [Any] {
            return array.map { sortKeys($0) }
        }
        return obj
    }

    private static func utf16Sort(_ a: String, _ b: String) -> Bool {
        a.utf16.lexicographicallyPrecedes(b.utf16)
    }

    private static func toCanonicalJSON(_ obj: Any) throws -> String {
        switch obj {
        case is NSNull:
            return "null"
        case let value as String:
            return "\"\(escapeJSONString(value))\""
        case let value as NSNumber:
            if CFGetTypeID(value) == CFBooleanGetTypeID() {
                return value.boolValue ? "true" : "false"
            }
            return formatJSONNumber(value.doubleValue)
        case let value as Bool:
            return value ? "true" : "false"
        case let value as Int:
            return formatJSONNumber(Double(value))
        case let value as Int64:
            return formatJSONNumber(Double(value))
        case let value as Double:
            return formatJSONNumber(value)
        case let dict as [String: Any]:
            let parts = try dict.keys.sorted(by: utf16Sort).map { key in
                let encoded = try toCanonicalJSON(dict[key]!)
                return "\"\(escapeJSONString(key))\":\(encoded)"
            }
            return "{\(parts.joined(separator: ","))}"
        case let array as [Any]:
            let parts = try array.map { try toCanonicalJSON($0) }
            return "[\(parts.joined(separator: ","))]"
        default:
            throw CryptoError.invalidInput("Unsupported JSON type for canonical encoding")
        }
    }

    private static func escapeJSONString(_ value: String) -> String {
        var out = ""
        out.reserveCapacity(value.count + 8)
        for scalar in value.unicodeScalars {
            switch scalar.value {
            case 0x22:
                out.append("\\\"")
            case 0x5c:
                out.append("\\\\")
            case 0x08:
                out.append("\\b")
            case 0x0c:
                out.append("\\f")
            case 0x0a:
                out.append("\\n")
            case 0x0d:
                out.append("\\r")
            case 0x09:
                out.append("\\t")
            case 0 ..< 0x20:
                out.append(String(format: "\\u%04x", scalar.value))
            default:
                out.unicodeScalars.append(scalar)
            }
        }
        return out
    }

    private static func formatJSONNumber(_ value: Double) -> String {
        if value.isNaN || value.isInfinite {
            return "null"
        }

        if value == 0 || value == -0 {
            return "0"
        }

        let absValue = abs(value)
        if value.rounded() == value, absValue < 1e21 {
            return String(Int64(value))
        }

        let useDecimal = absValue > 1e-7 && absValue < 1e21
        if useDecimal {
            return shortestDecimalString(value)
        }
        return scientificString(value)
    }

    /// Shortest round-trip decimal text, trimmed like JS Number#toString for non-scientific range.
    private static func shortestDecimalString(_ value: Double) -> String {
        var text = String(value)
        if text.contains("e") || text.contains("E") {
            text = String(format: "%.17g", value)
        }
        if text.contains(".") {
            while text.hasSuffix("0") {
                text.removeLast()
            }
            if text.hasSuffix(".") {
                text.removeLast()
            }
        }
        return text
    }

    /// JS-style exponential notation with explicit '+' on positive exponent.
    private static func scientificString(_ value: Double) -> String {
        let negative = value < 0
        let absValue = abs(value)
        var exponent = Int(floor(log10(absValue)))
        let mantissa = absValue / pow(10.0, Double(exponent))

        var mantissaText = String(mantissa)
        if mantissaText.contains("e") || mantissaText.contains("E") {
            mantissaText = String(format: "%.17g", mantissa)
        }
        if mantissaText.contains(".") {
            while mantissaText.hasSuffix("0") {
                mantissaText.removeLast()
            }
            if mantissaText.hasSuffix(".") {
                mantissaText.removeLast()
            }
        }

        if mantissaText.hasPrefix("10") && (mantissaText == "10" || mantissaText.hasPrefix("10.")) {
            mantissaText = "1"
            exponent += 1
        }

        let sign = negative ? "-" : ""
        let expSign = exponent >= 0 ? "+" : ""
        return "\(sign)\(mantissaText)e\(expSign)\(exponent)"
    }
}

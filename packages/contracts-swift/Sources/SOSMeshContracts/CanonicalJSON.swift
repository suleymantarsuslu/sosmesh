import Foundation

/// Canonical JSON for crypto AAD (matches `packages/contracts` `canonicalJSON` / `JSON.stringify(sortKeys(...))`).
///
/// SOSMesh envelope objects use string keys only (never integer-like keys such as `"1"` or `"10"`);
/// JavaScript would enumerate those in numeric order, which we intentionally do not support.
///
/// Native Swift `String` cannot represent unpaired UTF-16 surrogates (they become U+FFFD). Production
/// SOSMesh AAD uses only JSON-parsed envelope fields, which never contain lone surrogates. The
/// `canonical-json-001` lone-surrogate vector is covered by passing `NSString` built from UTF-16 code
/// units; `encode` reads those code units without bridging to Swift `String`.
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

    private static func utf16SortKeys(_ a: Any, _ b: Any) -> Bool {
        utf16CodeUnits(of: a).lexicographicallyPrecedes(utf16CodeUnits(of: b))
    }

    private static func utf16CodeUnits(of key: Any) -> [UTF16.CodeUnit] {
        if let ns = key as? NSString {
            return nsUtf16CodeUnits(ns)
        }
        if let string = key as? String {
            return Array(string.utf16)
        }
        return []
    }

    private static func nsUtf16CodeUnits(_ ns: NSString) -> [UTF16.CodeUnit] {
        let length = ns.length
        var units = [UTF16.CodeUnit]()
        units.reserveCapacity(length)
        for index in 0 ..< length {
            units.append(UTF16.CodeUnit(ns.character(at: index)))
        }
        return units
    }

    /// JSON fragment encoder (order matters: `NSNumber` before `Bool` so 0/1 are never booleans).
    private static func toCanonicalJSON(_ obj: Any) throws -> String {
        if obj is NSNull {
            return "null"
        }
        if obj is NSString {
            let ns = obj as! NSString
            return "\"\(escapeJSONString(ns))\""
        }
        if let string = obj as? String {
            return "\"\(escapeJSONString(string as NSString))\""
        }
        if let number = obj as? NSNumber {
            if CFGetTypeID(number) == CFBooleanGetTypeID() {
                return number.boolValue ? "true" : "false"
            }
            return formatJSONNumber(number.doubleValue)
        }
        if let boolean = obj as? Bool {
            return boolean ? "true" : "false"
        }
        if let dict = obj as? [String: Any] {
            let parts = try dict.keys.sorted(by: utf16Sort).map { key in
                let encoded = try toCanonicalJSON(dict[key]!)
                return "\"\(escapeJSONString(key as NSString))\":\(encoded)"
            }
            return "{\(parts.joined(separator: ","))}"
        }
        if let dict = obj as? [AnyHashable: Any] {
            let entries = dict.map { (key: $0.key, value: $0.value) }
            let sorted = entries.sorted { utf16SortKeys($0.key, $1.key) }
            let parts = try sorted.map { entry in
                let encoded = try toCanonicalJSON(entry.value)
                return "\"\(escapeJSONString(jsonObjectKeyAsNSString(entry.key)))\":\(encoded)"
            }
            return "{\(parts.joined(separator: ","))}"
        }
        if let array = obj as? [Any] {
            let parts = try array.map { try toCanonicalJSON($0) }
            return "[\(parts.joined(separator: ","))]"
        }
        if let value = obj as? Int {
            return formatJSONNumber(Double(value))
        }
        if let value = obj as? Int64 {
            return formatJSONNumber(Double(value))
        }
        if let value = obj as? Double {
            return formatJSONNumber(value)
        }
        throw CryptoError.invalidInput("Unsupported JSON type for canonical encoding")
    }

    private static func jsonObjectKeyAsNSString(_ key: AnyHashable) -> NSString {
        if let ns = key.base as? NSString {
            return ns
        }
        if let string = key.base as? String {
            return string as NSString
        }
        return String(describing: key.base) as NSString
    }

    /// `JSON.stringify` string escaping (UTF-16 code units via NSString; lone surrogates as `\uXXXX`).
    private static func escapeJSONString(_ value: NSString) -> String {
        let length = value.length
        var out = ""
        out.reserveCapacity(value.length + 8)
        var index = 0
        while index < length {
            let unit = value.character(at: index)
            if isHighSurrogate(UTF16.CodeUnit(unit)), index + 1 < length {
                let nextUnit = value.character(at: index + 1)
                if isLowSurrogate(UTF16.CodeUnit(nextUnit)) {
                    var pair: [unichar] = [unit, nextUnit]
                    out.append(String(utf16CodeUnits: pair, count: 2))
                    index += 2
                    continue
                }
            }
            appendEscapedUTF16Unit(UTF16.CodeUnit(unit), to: &out)
            index += 1
        }
        return out
    }

    private static func isHighSurrogate(_ unit: UTF16.CodeUnit) -> Bool {
        unit >= 0xD800 && unit <= 0xDBFF
    }

    private static func isLowSurrogate(_ unit: UTF16.CodeUnit) -> Bool {
        unit >= 0xDC00 && unit <= 0xDFFF
    }

    private static func appendEscapedUTF16Unit(_ unit: UTF16.CodeUnit, to out: inout String) {
        switch unit {
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
        case 0x0000 ... 0x001f:
            out.append(String(format: "\\u%04x", unit))
        case 0xD800 ... 0xDFFF:
            out.append(String(format: "\\u%04x", unit))
        default:
            out.append(String(utf16CodeUnits: [unit], count: 1))
        }
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

        let useDecimal = absValue >= 1e-6 && absValue < 1e21
        if useDecimal {
            return shortestDecimalString(value)
        }
        return scientificString(value)
    }

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

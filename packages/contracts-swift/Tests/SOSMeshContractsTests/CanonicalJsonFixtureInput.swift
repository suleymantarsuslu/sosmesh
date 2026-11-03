import Foundation

enum CanonicalJsonFixtureInput {
    static let utf16StringTag = "__canonicalJsonUtf16String"

    /// Reconstruct logical input from fixture JSON (`encodeInputForFixtureFile` in TS).
    static func decode(_ encoded: Any) throws -> Any {
        if let dict = encoded as? [String: Any] {
            if dict.count == 1, let units = dict[utf16StringTag] as? [NSNumber] {
                var utf16 = [unichar]()
                utf16.reserveCapacity(units.count)
                for unit in units {
                    utf16.append(unichar(truncatingIfNeeded: unit.intValue))
                }
                return utf16.withUnsafeBufferPointer { buffer in
                    guard let base = buffer.baseAddress else { return "" }
                    return NSString(characters: base, length: buffer.count) as String
                }
            }
            var out = [String: Any]()
            for (key, value) in dict {
                out[key] = try decode(value)
            }
            return out
        }
        if let array = encoded as? [Any] {
            return try array.map { try decode($0) }
        }
        return encoded
    }
}

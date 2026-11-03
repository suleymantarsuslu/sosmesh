import Foundation

enum CanonicalJsonFixtureInput {
    static let utf16StringTag = "__canonicalJsonUtf16String"

    /// Reconstruct logical input from fixture JSON (`encodeInputForFixtureFile` in TS).
    static func decode(_ encoded: Any) throws -> Any {
        if let dict = encoded as? [String: Any] {
            if dict.count == 1, let units = dict[utf16StringTag] as? [NSNumber] {
                var utf16 = [UTF16.CodeUnit]()
                utf16.reserveCapacity(units.count)
                for unit in units {
                    utf16.append(UTF16.CodeUnit(truncatingIfNeeded: unit.intValue))
                }
                return String(decoding: utf16, as: UTF16.self)
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

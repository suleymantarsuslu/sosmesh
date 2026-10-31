import Foundation

public enum SosEnvelopeRulesError: Error, Equatable {
    case invalidTimestamp(String)
}

public enum SosEnvelopeRules {
    private static let isoInstantRegex =
        #"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$"#

    public static func validateTimestamp(_ timestamp: String) throws {
        guard timestamp.range(of: isoInstantRegex, options: .regularExpression) != nil else {
            throw SosEnvelopeRulesError.invalidTimestamp(timestamp)
        }
    }
}

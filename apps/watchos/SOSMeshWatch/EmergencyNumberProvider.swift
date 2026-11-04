import Foundation

enum EmergencyNumberProvider {
    private static let emergencyNumberMap: [String: String] = [
        "US": "911",
        "CA": "911",
        "MX": "911",
        "GB": "999",
        "AU": "000",
        "NZ": "111",
        "JP": "110",
        "CN": "110",
        "IN": "112",
        "BR": "190",
        "AR": "911",
        "CL": "133",
        "CO": "123",
        "PE": "105",
        "MY": "999",
        "SG": "999",
        "TH": "191",
        "VN": "113",
        "PH": "911",
        "ID": "112",
        "ZA": "10111",
        "EG": "122",
        "IL": "100",
        "SA": "999",
        "AE": "999",
        "RU": "112",
        "UA": "112",
        "KR": "112",
        "TR": "112",
        "AT": "112",
        "BE": "112",
        "BG": "112",
        "HR": "112",
        "CY": "112",
        "CZ": "112",
        "DK": "112",
        "EE": "112",
        "FI": "112",
        "FR": "112",
        "DE": "112",
        "GR": "112",
        "HU": "112",
        "IE": "112",
        "IT": "112",
        "LV": "112",
        "LT": "112",
        "LU": "112",
        "MT": "112",
        "NL": "112",
        "PL": "112",
        "PT": "112",
        "RO": "112",
        "SK": "112",
        "SI": "112",
        "ES": "112",
        "SE": "112",
        "NO": "112",
        "IS": "112",
        "LI": "112",
        "CH": "112",
        "AL": "112",
        "BA": "112",
        "ME": "112",
        "MK": "112",
        "RS": "112",
        "XK": "112",
    ]
    
    static func getEmergencyNumber() -> String {
        if let countryCode = detectCountryCode() {
            return emergencyNumberMap[countryCode] ?? "112"
        }
        return "112"
    }
    
    private static func detectCountryCode() -> String? {
        if let regionCode = Locale.current.region?.identifier {
            return regionCode.uppercased()
        }
        return nil
    }
}

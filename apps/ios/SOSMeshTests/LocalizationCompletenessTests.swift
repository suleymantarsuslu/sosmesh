import XCTest

/// Test that English and Turkish localization files contain the same keys.
/// Ensures no missing translations and that EN is the complete base.
final class LocalizationCompletenessTests: XCTestCase {
    
    func testIOSLocalizableKeysMatch() throws {
        let (enDict, trDict) = try loadLocalizationDicts(table: "Localizable")
        
        XCTAssertFalse(enDict.isEmpty, "English Localizable.strings must not be empty")
        XCTAssertFalse(trDict.isEmpty, "Turkish Localizable.strings must not be empty")
        
        let enKeys = Set(enDict.keys)
        let trKeys = Set(trDict.keys)
        
        let missingInTR = enKeys.subtracting(trKeys)
        let extraInTR = trKeys.subtracting(enKeys)
        
        XCTAssertTrue(missingInTR.isEmpty, "Turkish Localizable.strings is missing keys: \(missingInTR.sorted())")
        XCTAssertTrue(extraInTR.isEmpty, "Turkish Localizable.strings has extra keys not in English: \(extraInTR.sorted())")
        
        XCTAssertEqual(enKeys.count, trKeys.count, "EN and TR Localizable.strings must have the same number of keys")
        
        // Check that no value is empty or equal to its key (untranslated)
        try validateNonEmptyValues(dict: enDict, language: "English")
        try validateNonEmptyValues(dict: trDict, language: "Turkish")
    }
    
    func testIOSInfoPlistKeysMatch() throws {
        let (enDict, trDict) = try loadLocalizationDicts(table: "InfoPlist")
        
        XCTAssertFalse(enDict.isEmpty, "English InfoPlist.strings must not be empty")
        XCTAssertFalse(trDict.isEmpty, "Turkish InfoPlist.strings must not be empty")
        
        let enKeys = Set(enDict.keys)
        let trKeys = Set(trDict.keys)
        
        let missingInTR = enKeys.subtracting(trKeys)
        let extraInTR = trKeys.subtracting(enKeys)
        
        XCTAssertTrue(missingInTR.isEmpty, "Turkish InfoPlist.strings is missing keys: \(missingInTR.sorted())")
        XCTAssertTrue(extraInTR.isEmpty, "Turkish InfoPlist.strings has extra keys not in English: \(extraInTR.sorted())")
        
        XCTAssertEqual(enKeys.count, trKeys.count, "EN and TR InfoPlist.strings must have the same number of keys")
        
        // Check that no value is empty or equal to its key
        try validateNonEmptyValues(dict: enDict, language: "English")
        try validateNonEmptyValues(dict: trDict, language: "Turkish")
    }
    
    func testIOSInfoPlistContainsRequiredPermissionStrings() throws {
        let (enDict, trDict) = try loadLocalizationDicts(table: "InfoPlist")
        
        // Verify permission strings exist in both languages
        XCTAssertTrue(enDict.keys.contains("NSBluetoothAlwaysUsageDescription"), "English InfoPlist.strings must contain Bluetooth usage description")
        XCTAssertTrue(enDict.keys.contains("NSLocationWhenInUseUsageDescription"), "English InfoPlist.strings must contain Location usage description")
        XCTAssertTrue(enDict.keys.contains("NSUserNotificationsUsageDescription"), "English InfoPlist.strings must contain Notifications usage description")
        
        XCTAssertTrue(trDict.keys.contains("NSBluetoothAlwaysUsageDescription"), "Turkish InfoPlist.strings must contain Bluetooth usage description")
        XCTAssertTrue(trDict.keys.contains("NSLocationWhenInUseUsageDescription"), "Turkish InfoPlist.strings must contain Location usage description")
        XCTAssertTrue(trDict.keys.contains("NSUserNotificationsUsageDescription"), "Turkish InfoPlist.strings must contain Notifications usage description")
    }
    
    func testLocalizable112WarningsExist() throws {
        let (enDict, trDict) = try loadLocalizationDicts(table: "Localizable")
        
        // Check that 112 warning keys exist
        let warningKey = "onboarding.not112"
        
        XCTAssertTrue(enDict.keys.contains(warningKey), "English Localizable.strings must contain '\(warningKey)' key")
        XCTAssertTrue(trDict.keys.contains(warningKey), "Turkish Localizable.strings must contain '\(warningKey)' key")
        
        // Verify values are non-empty and contain "112"
        let enValue = enDict[warningKey] ?? ""
        let trValue = trDict[warningKey] ?? ""
        
        XCTAssertFalse(enValue.isEmpty, "English '\(warningKey)' value must not be empty")
        XCTAssertFalse(trValue.isEmpty, "Turkish '\(warningKey)' value must not be empty")
        
        XCTAssertTrue(enValue.contains("112"), "English '\(warningKey)' must contain '112': \(enValue)")
        XCTAssertTrue(trValue.contains("112"), "Turkish '\(warningKey)' must contain '112': \(trValue)")
        
        // Also check gate.action.call112
        let callKey = "gate.action.call112"
        XCTAssertTrue(enDict.keys.contains(callKey), "English must contain '\(callKey)' key")
        XCTAssertTrue(trDict.keys.contains(callKey), "Turkish must contain '\(callKey)' key")
        
        let enCall = enDict[callKey] ?? ""
        let trCall = trDict[callKey] ?? ""
        
        XCTAssertTrue(enCall.contains("112"), "English '\(callKey)' must contain '112': \(enCall)")
        XCTAssertTrue(trCall.contains("112"), "Turkish '\(callKey)' must contain '112': \(trCall)")
    }
    
    func testDevelopmentRegionIsEnglish() throws {
        let infoPlist = Bundle.main.infoDictionary
        let developmentRegion = infoPlist?["CFBundleDevelopmentRegion"] as? String
        
        XCTAssertEqual(developmentRegion, "en", "CFBundleDevelopmentRegion must be 'en' (English)")
    }
    
    // MARK: - Helpers
    
    private func loadLocalizationDicts(table: String) throws -> ([String: String], [String: String]) {
        let enDict = try loadLocalizationDict(bundle: Bundle.main, table: table, language: "en")
        let trDict = try loadLocalizationDict(bundle: Bundle.main, table: table, language: "tr")
        return (enDict, trDict)
    }
    
    private func loadLocalizationDict(bundle: Bundle, table: String, language: String) throws -> [String: String] {
        guard let path = bundle.path(forResource: table, ofType: "strings", inDirectory: nil, forLocalization: language) else {
            throw NSError(
                domain: "LocalizationCompletenessTests",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Could not find \(table).strings for language \(language)"]
            )
        }
        
        guard let dict = NSDictionary(contentsOfFile: path) as? [String: String] else {
            throw NSError(
                domain: "LocalizationCompletenessTests",
                code: 2,
                userInfo: [NSLocalizedDescriptionKey: "Could not parse \(table).strings at \(path)"]
            )
        }
        
        return dict
    }
    
    private func validateNonEmptyValues(dict: [String: String], language: String) throws {
        for (key, value) in dict {
            XCTAssertFalse(value.isEmpty, "\(language) value for key '\(key)' must not be empty")
            XCTAssertNotEqual(value, key, "\(language) value for key '\(key)' must not equal the key (untranslated)")
        }
    }
}

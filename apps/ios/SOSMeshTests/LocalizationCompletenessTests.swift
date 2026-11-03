import XCTest

/// Test that English and Turkish localization files contain the same keys.
/// Ensures no missing translations and that EN is the complete base.
final class LocalizationCompletenessTests: XCTestCase {
    
    func testIOSLocalizableKeysMatch() throws {
        let enKeys = try loadLocalizationKeys(
            bundle: Bundle.main,
            table: "Localizable",
            language: "en"
        )
        let trKeys = try loadLocalizationKeys(
            bundle: Bundle.main,
            table: "Localizable",
            language: "tr"
        )
        
        XCTAssertFalse(enKeys.isEmpty, "English Localizable.strings must not be empty")
        XCTAssertFalse(trKeys.isEmpty, "Turkish Localizable.strings must not be empty")
        
        let missingInTR = enKeys.subtracting(trKeys)
        let extraInTR = trKeys.subtracting(enKeys)
        
        XCTAssertTrue(missingInTR.isEmpty, "Turkish Localizable.strings is missing keys: \(missingInTR.sorted())")
        XCTAssertTrue(extraInTR.isEmpty, "Turkish Localizable.strings has extra keys not in English: \(extraInTR.sorted())")
        
        XCTAssertEqual(enKeys.count, trKeys.count, "EN and TR Localizable.strings must have the same number of keys")
    }
    
    func testIOSInfoPlistKeysMatch() throws {
        let enKeys = try loadLocalizationKeys(
            bundle: Bundle.main,
            table: "InfoPlist",
            language: "en"
        )
        let trKeys = try loadLocalizationKeys(
            bundle: Bundle.main,
            table: "InfoPlist",
            language: "tr"
        )
        
        XCTAssertFalse(enKeys.isEmpty, "English InfoPlist.strings must not be empty")
        XCTAssertFalse(trKeys.isEmpty, "Turkish InfoPlist.strings must not be empty")
        
        let missingInTR = enKeys.subtracting(trKeys)
        let extraInTR = trKeys.subtracting(enKeys)
        
        XCTAssertTrue(missingInTR.isEmpty, "Turkish InfoPlist.strings is missing keys: \(missingInTR.sorted())")
        XCTAssertTrue(extraInTR.isEmpty, "Turkish InfoPlist.strings has extra keys not in English: \(extraInTR.sorted())")
        
        XCTAssertEqual(enKeys.count, trKeys.count, "EN and TR InfoPlist.strings must have the same number of keys")
    }
    
    func testIOSInfoPlistContainsRequired112Warning() throws {
        let enKeys = try loadLocalizationKeys(
            bundle: Bundle.main,
            table: "InfoPlist",
            language: "en"
        )
        let trKeys = try loadLocalizationKeys(
            bundle: Bundle.main,
            table: "InfoPlist",
            language: "tr"
        )
        
        XCTAssertTrue(enKeys.contains("NSBluetoothAlwaysUsageDescription"), "English InfoPlist.strings must contain Bluetooth usage description")
        XCTAssertTrue(enKeys.contains("NSLocationWhenInUseUsageDescription"), "English InfoPlist.strings must contain Location usage description")
        XCTAssertTrue(enKeys.contains("NSUserNotificationsUsageDescription"), "English InfoPlist.strings must contain Notifications usage description")
        
        XCTAssertTrue(trKeys.contains("NSBluetoothAlwaysUsageDescription"), "Turkish InfoPlist.strings must contain Bluetooth usage description")
        XCTAssertTrue(trKeys.contains("NSLocationWhenInUseUsageDescription"), "Turkish InfoPlist.strings must contain Location usage description")
        XCTAssertTrue(trKeys.contains("NSUserNotificationsUsageDescription"), "Turkish InfoPlist.strings must contain Notifications usage description")
    }
    
    func testDevelopmentRegionIsEnglish() throws {
        let infoPlist = Bundle.main.infoDictionary
        let developmentRegion = infoPlist?["CFBundleDevelopmentRegion"] as? String
        
        XCTAssertEqual(developmentRegion, "en", "CFBundleDevelopmentRegion must be 'en' (English)")
    }
    
    // MARK: - Helper
    
    private func loadLocalizationKeys(bundle: Bundle, table: String, language: String) throws -> Set<String> {
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
        
        return Set(dict.keys)
    }
}

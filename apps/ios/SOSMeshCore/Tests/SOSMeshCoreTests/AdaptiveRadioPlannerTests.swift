import XCTest
@testable import SOSMeshCore

final class AdaptiveRadioPlannerCrossLanguageTests: XCTestCase {
    func sourceRoot() -> String {
        if let envRoot = ProcessInfo.processInfo.environment["SOURCE_ROOT"] {
            return envRoot
        }
        var url = URL(fileURLWithPath: #filePath)
        for _ in 0..<5 {
            url.deleteLastPathComponent()
        }
        return url.path
    }

    func loadCases() throws -> [[String: Any]] {
        guard let url = Bundle.module.url(forResource: "radio-planner-cases", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let root = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let cases = root["cases"] as? [[String: Any]] else {
            XCTFail("radio-planner-cases.json missing or invalid")
            return []
        }
        return cases
    }

    func testBundledVectorsByteMatchMaster() throws {
        guard let bundledURL = Bundle.module.url(forResource: "radio-planner-cases", withExtension: "json") else {
            XCTFail("Bundled radio-planner-cases.json missing")
            return
        }
        let masterURL = URL(fileURLWithPath: sourceRoot())
            .appendingPathComponent("packages/contracts/radio-planner/vectors/radio-planner-cases.json")
        let bundled = try Data(contentsOf: bundledURL)
        let master = try Data(contentsOf: masterURL)
        XCTAssertEqual(bundled, master)
    }

    func testCrossLanguageVectorsMatchGolden() throws {
        let cases = try loadCases()
        for caseDict in cases {
            let id = caseDict["id"] as! String
            let inputJson = caseDict["input"] as! [String: Any]
            let expect = caseDict["expect"] as! [String: Any]

            let input = RadioPlannerInput(
                bluetoothEnabled: inputJson["bluetoothEnabled"] as! Bool,
                blePermissionsGranted: inputJson["blePermissionsGranted"] as! Bool,
                sosTransferActive: inputJson["sosTransferActive"] as! Bool,
                relayOptIn: inputJson["relayOptIn"] as! Bool,
                batteryLevelPercent: inputJson["batteryLevelPercent"] as! Int,
                batteryLowThresholdPercent: inputJson["batteryLowThresholdPercent"] as! Int,
                powerSaveEnabled: inputJson["powerSaveEnabled"] as! Bool,
                deviceIdle: inputJson["deviceIdle"] as! Bool,
                thermalThrottled: inputJson["thermalThrottled"] as! Bool,
                highPowerRadioConsent: inputJson["highPowerRadioConsent"] as! Bool,
                duplicateTrafficRatioBps: inputJson["duplicateTrafficRatioBps"] as! Int,
                linkQualityScoreBps: inputJson["linkQualityScoreBps"] as! Int
            )
            let decision = AdaptiveRadioPlanner.plan(input)
            XCTAssertEqual(decision.profileId.rawValue, expect["profileId"] as! String, id)
            XCTAssertEqual(decision.radioProfile.scanMode, expect["scanMode"] as! Int, id)
            XCTAssertEqual(decision.radioProfile.scanPeriodMs, (expect["scanPeriodMs"] as! NSNumber).int64Value, id)
            XCTAssertEqual(decision.radioProfile.scanPauseMs, (expect["scanPauseMs"] as! NSNumber).int64Value, id)
            XCTAssertEqual(decision.radioProfile.scanningAllowed, expect["scanningAllowed"] as! Bool, id)
            XCTAssertEqual(decision.radioProfile.advertiseIntervalMs, (expect["advertiseIntervalMs"] as! NSNumber).int64Value, id)
            XCTAssertEqual(decision.radioProfile.advertiseAllowed, expect["advertiseAllowed"] as! Bool, id)
            XCTAssertEqual(
                decision.requiresHighPowerConsentPrompt,
                expect["requiresHighPowerConsentPrompt"] as! Bool,
                id
            )
            XCTAssertEqual(decision.dutyCycleClass.rawValue, expect["dutyCycleClass"] as! String, id)
        }
    }
}

final class AdaptiveRadioPlannerMutationTests: XCTestCase {
    func testIgnoreLowPowerConstraintsChangesSosConstrainedVsBaseline() {
        let input = RadioPlannerInput(
            bluetoothEnabled: true,
            blePermissionsGranted: true,
            sosTransferActive: true,
            relayOptIn: false,
            batteryLevelPercent: 70,
            batteryLowThresholdPercent: 15,
            powerSaveEnabled: false,
            deviceIdle: false,
            thermalThrottled: true,
            highPowerRadioConsent: false,
            duplicateTrafficRatioBps: 0,
            linkQualityScoreBps: 5000
        )
        let baseline = AdaptiveRadioPlanner.plan(input)
        XCTAssertEqual(baseline.profileId, .sosConstrained)

        let mutated = AdaptiveRadioPlanner.plan(
            input,
            testingHooks: RadioPlannerTestingHooks(ignoreLowPowerConstraints: true)
        )
        XCTAssertEqual(mutated.profileId, .sosUrgent)
    }
}

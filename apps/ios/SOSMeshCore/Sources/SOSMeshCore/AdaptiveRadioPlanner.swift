import Foundation

public enum RadioDutyCycleClass: String, Sendable {
    case sosActive = "SOS_ACTIVE"
    case relayPassive = "RELAY_PASSIVE"
    case blocked = "BLOCKED"
}

public enum RadioProfileId: String, Sendable {
    case blocked = "BLOCKED"
    case sosUrgent = "SOS_URGENT"
    case sosConstrained = "SOS_CONSTRAINED"
    case relayPassive = "RELAY_PASSIVE"
    case relayConstrained = "RELAY_CONSTRAINED"
    case relayHighPower = "RELAY_HIGH_POWER"
}

public struct RadioPlannerInput: Sendable {
    public var bluetoothEnabled: Bool
    public var blePermissionsGranted: Bool
    public var sosTransferActive: Bool
    public var relayOptIn: Bool
    public var batteryLevelPercent: Int
    public var batteryLowThresholdPercent: Int
    public var powerSaveEnabled: Bool
    public var deviceIdle: Bool
    public var thermalThrottled: Bool
    public var highPowerRadioConsent: Bool
    public var duplicateTrafficRatioBps: Int
    public var linkQualityScoreBps: Int

    public init(
        bluetoothEnabled: Bool,
        blePermissionsGranted: Bool,
        sosTransferActive: Bool,
        relayOptIn: Bool,
        batteryLevelPercent: Int,
        batteryLowThresholdPercent: Int,
        powerSaveEnabled: Bool,
        deviceIdle: Bool,
        thermalThrottled: Bool,
        highPowerRadioConsent: Bool,
        duplicateTrafficRatioBps: Int,
        linkQualityScoreBps: Int
    ) {
        self.bluetoothEnabled = bluetoothEnabled
        self.blePermissionsGranted = blePermissionsGranted
        self.sosTransferActive = sosTransferActive
        self.relayOptIn = relayOptIn
        self.batteryLevelPercent = batteryLevelPercent
        self.batteryLowThresholdPercent = batteryLowThresholdPercent
        self.powerSaveEnabled = powerSaveEnabled
        self.deviceIdle = deviceIdle
        self.thermalThrottled = thermalThrottled
        self.highPowerRadioConsent = highPowerRadioConsent
        self.duplicateTrafficRatioBps = duplicateTrafficRatioBps
        self.linkQualityScoreBps = linkQualityScoreBps
    }

    public var batteryCritical: Bool {
        batteryLevelPercent < batteryLowThresholdPercent
    }
}

public struct EnergyRadioPlan: Equatable, Sendable {
    public var scanMode: Int
    public var scanPeriodMs: Int64
    public var scanPauseMs: Int64
    public var scanningAllowed: Bool
    public var advertiseIntervalMs: Int64
    public var advertiseAllowed: Bool

    public init(
        scanMode: Int,
        scanPeriodMs: Int64,
        scanPauseMs: Int64,
        scanningAllowed: Bool,
        advertiseIntervalMs: Int64,
        advertiseAllowed: Bool
    ) {
        self.scanMode = scanMode
        self.scanPeriodMs = scanPeriodMs
        self.scanPauseMs = scanPauseMs
        self.scanningAllowed = scanningAllowed
        self.advertiseIntervalMs = advertiseIntervalMs
        self.advertiseAllowed = advertiseAllowed
    }
}

public struct RadioPlannerDecision: Equatable, Sendable {
    public var profileId: RadioProfileId
    public var radioProfile: EnergyRadioPlan
    public var requiresHighPowerConsentPrompt: Bool
    public var dutyCycleClass: RadioDutyCycleClass
}

struct RadioPlannerTestingHooks: Sendable {
    var ignoreLowPowerConstraints: Bool

    init(ignoreLowPowerConstraints: Bool = false) {
        self.ignoreLowPowerConstraints = ignoreLowPowerConstraints
    }

    static let none = RadioPlannerTestingHooks()
}

public enum AdaptiveRadioPlanner {
    private static let duplicateSlowThresholdBps = 2500
    private static let linkPoorThresholdBps = 2500
    private static let duplicateLowForBoostBps = 2000
    private static let relayBatterySoftConstrainedPercent = 25

    public static func plan(_ input: RadioPlannerInput) -> RadioPlannerDecision {
        planInternal(input, testingHooks: .none)
    }

    static func planInternal(
        _ input: RadioPlannerInput,
        testingHooks: RadioPlannerTestingHooks
    ) -> RadioPlannerDecision {
        if !input.blePermissionsGranted {
            return blockedDecision()
        }
        if !input.bluetoothEnabled {
            if input.sosTransferActive {
                return sosDecision(input, testingHooks: testingHooks)
            }
            return blockedDecision()
        }
        if input.batteryCritical && input.relayOptIn && !input.sosTransferActive {
            return blockedDecision()
        }
        if input.sosTransferActive {
            return sosDecision(input, testingHooks: testingHooks)
        }
        if input.relayOptIn {
            return relayDecision(input, testingHooks: testingHooks)
        }
        return passiveRelayWithPause(input, requiresConsentPrompt: false)
    }

    private static func sosDecision(
        _ input: RadioPlannerInput,
        testingHooks: RadioPlannerTestingHooks
    ) -> RadioPlannerDecision {
        let constrained =
            !testingHooks.ignoreLowPowerConstraints
            && (input.thermalThrottled || input.powerSaveEnabled || input.deviceIdle)
        if constrained {
            return RadioPlannerDecision(
                profileId: .sosConstrained,
                radioProfile: EnergyRadioPlan.sosConstrained,
                requiresHighPowerConsentPrompt: false,
                dutyCycleClass: .sosActive
            )
        }
        return RadioPlannerDecision(
            profileId: .sosUrgent,
            radioProfile: EnergyRadioPlan.sosUrgent,
            requiresHighPowerConsentPrompt: false,
            dutyCycleClass: .sosActive
        )
    }

    private static func relayDecision(
        _ input: RadioPlannerInput,
        testingHooks: RadioPlannerTestingHooks
    ) -> RadioPlannerDecision {
        let constrained =
            !testingHooks.ignoreLowPowerConstraints
            && (input.powerSaveEnabled || input.deviceIdle || input.thermalThrottled
                || input.batteryLevelPercent < relayBatterySoftConstrainedPercent)
        if constrained {
            return RadioPlannerDecision(
                profileId: .relayConstrained,
                radioProfile: EnergyRadioPlan.relayConstrained,
                requiresHighPowerConsentPrompt: false,
                dutyCycleClass: .relayPassive
            )
        }

        let wantsBoost =
            input.linkQualityScoreBps < linkPoorThresholdBps
            && input.duplicateTrafficRatioBps < duplicateLowForBoostBps
        if wantsBoost && input.highPowerRadioConsent {
            return RadioPlannerDecision(
                profileId: .relayHighPower,
                radioProfile: EnergyRadioPlan.relayHighPower,
                requiresHighPowerConsentPrompt: false,
                dutyCycleClass: .relayPassive
            )
        }
        if wantsBoost && !input.highPowerRadioConsent {
            return passiveRelayWithPause(input, requiresConsentPrompt: true)
        }
        return passiveRelayWithPause(input, requiresConsentPrompt: false)
    }

    private static func passiveRelayWithPause(
        _ input: RadioPlannerInput,
        requiresConsentPrompt: Bool
    ) -> RadioPlannerDecision {
        let base = EnergyRadioPlan.relayPassive
        let extraPause: Int64 =
            input.duplicateTrafficRatioBps >= duplicateSlowThresholdBps
            ? base.scanPauseMs / 2
            : 0
        let profile: EnergyRadioPlan
        if extraPause > 0 {
            profile = EnergyRadioPlan(
                scanMode: base.scanMode,
                scanPeriodMs: base.scanPeriodMs,
                scanPauseMs: base.scanPauseMs + extraPause,
                scanningAllowed: base.scanningAllowed,
                advertiseIntervalMs: base.advertiseIntervalMs,
                advertiseAllowed: base.advertiseAllowed
            )
        } else {
            profile = base
        }
        return RadioPlannerDecision(
            profileId: .relayPassive,
            radioProfile: profile,
            requiresHighPowerConsentPrompt: requiresConsentPrompt,
            dutyCycleClass: .relayPassive
        )
    }

    private static func blockedDecision() -> RadioPlannerDecision {
        RadioPlannerDecision(
            profileId: .blocked,
            radioProfile: EnergyRadioPlan.blocked,
            requiresHighPowerConsentPrompt: false,
            dutyCycleClass: .blocked
        )
    }
}

extension EnergyRadioPlan {
    public static let blocked = EnergyRadioPlan(
        scanMode: 0,
        scanPeriodMs: 0,
        scanPauseMs: 0,
        scanningAllowed: false,
        advertiseIntervalMs: 0,
        advertiseAllowed: false
    )

    public static let relayPassive = EnergyRadioPlan(
        scanMode: 0,
        scanPeriodMs: 10_000,
        scanPauseMs: 5_000,
        scanningAllowed: true,
        advertiseIntervalMs: 400,
        advertiseAllowed: true
    )

    public static let relayHighPower = EnergyRadioPlan(
        scanMode: 1,
        scanPeriodMs: 7_000,
        scanPauseMs: 3_000,
        scanningAllowed: true,
        advertiseIntervalMs: 200,
        advertiseAllowed: true
    )

    public static let sosUrgent = EnergyRadioPlan(
        scanMode: 2,
        scanPeriodMs: 5_000,
        scanPauseMs: 2_000,
        scanningAllowed: true,
        advertiseIntervalMs: 160,
        advertiseAllowed: true
    )

    public static let sosConstrained = EnergyRadioPlan(
        scanMode: 1,
        scanPeriodMs: 8_000,
        scanPauseMs: 4_000,
        scanningAllowed: true,
        advertiseIntervalMs: 320,
        advertiseAllowed: true
    )

    public static let relayConstrained = EnergyRadioPlan(
        scanMode: 0,
        scanPeriodMs: 20_000,
        scanPauseMs: 15_000,
        scanningAllowed: true,
        advertiseIntervalMs: 800,
        advertiseAllowed: true
    )
}

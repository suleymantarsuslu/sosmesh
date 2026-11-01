import SwiftUI

struct CrossPlatformFaultBanner: View {
    let hint: CrossPlatformUserHint
    var onOpenSettings: () -> Void = {}

    var body: some View {
        if hint == .none {
            EmptyView()
        } else {
            VStack(alignment: .leading, spacing: 8) {
                Text("cross_platform.fault.title")
                    .font(.headline)
                    .accessibilityAddTraits(.isHeader)
                Text(messageKey)
                    .font(.body)
                    .accessibilityLabel(Text(messageKey))
                if hint == .fixPermissions || hint == .fixBluetooth {
                    Button("cross_platform.action.fix", action: onOpenSettings)
                        .accessibilityHint(Text("cross_platform.action.fix.hint"))
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.orange.opacity(0.15))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .accessibilityIdentifier("cross_platform_fault_banner")
        }
    }

    private var messageKey: LocalizedStringKey {
        switch hint {
        case .none: return ""
        case .fixBluetooth: return "cross_platform.hint.bluetooth"
        case .fixPermissions: return "cross_platform.hint.permissions"
        case .locationUnavailable: return "cross_platform.hint.location"
        case .transferCorrupt: return "cross_platform.hint.corrupt"
        case .apiUploadFailed: return "cross_platform.hint.api"
        case .networkOfflineRelay: return "cross_platform.hint.network"
        case .lowBatteryRelayPaused: return "cross_platform.hint.low_battery"
        }
    }
}

struct PlatformSelfRepairBanner: View {
    let hint: CrossPlatformUserHint
    let onOpenSettings: () -> Void

    var body: some View {
        if hint == .none {
            EmptyView()
        } else {
            VStack(alignment: .leading, spacing: 8) {
                Text("cross_platform.fault.title")
                    .font(.headline)
                Text(messageKey)
                if hint == .fixPermissions || hint == .fixBluetooth {
                    Button("cross_platform.action.fix", action: onOpenSettings)
                        .accessibilityHint(Text("cross_platform.action.fix.hint"))
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.red.opacity(0.12))
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }

    private var messageKey: LocalizedStringKey {
        switch hint {
        case .none: return ""
        case .fixBluetooth: return "cross_platform.hint.bluetooth"
        case .fixPermissions: return "cross_platform.hint.permissions"
        case .locationUnavailable: return "cross_platform.hint.location"
        case .transferCorrupt: return "cross_platform.hint.corrupt"
        case .apiUploadFailed: return "cross_platform.hint.api"
        case .networkOfflineRelay: return "cross_platform.hint.network"
        case .lowBatteryRelayPaused: return "cross_platform.hint.low_battery"
        }
    }
}

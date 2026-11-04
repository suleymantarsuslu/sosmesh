import SwiftUI
import SOSMeshCore

struct RelayView: View {
    @EnvironmentObject private var appModel: AppModel

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: DesignSystem.Spacing.lg) {
                    headerSection
                    
                    SOSCard {
                        VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
                            HStack {
                                VStack(alignment: .leading, spacing: DesignSystem.Spacing.xxs) {
                                    Text("relay.toggle.on")
                                        .font(DesignSystem.Typography.headline)
                                        .foregroundStyle(DesignSystem.Colors.textPrimary)
                                    Text("relay.description")
                                        .font(DesignSystem.Typography.callout)
                                        .foregroundStyle(DesignSystem.Colors.textSecondary)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                                
                                Spacer()
                                
                                Toggle("", isOn: $appModel.relayEnabled)
                                    .labelsHidden()
                                    .accessibilityLabel(Text("relay.toggle.aria"))
                            }
                        }
                    }
                    
                    SOSCard {
                        HStack(alignment: .top, spacing: DesignSystem.Spacing.sm) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.system(size: 20))
                                .foregroundStyle(DesignSystem.Colors.warningOrange)
                            VStack(alignment: .leading, spacing: DesignSystem.Spacing.xxs) {
                                Text("relay.warning")
                                    .font(DesignSystem.Typography.callout)
                                    .foregroundStyle(DesignSystem.Colors.textPrimary)
                                Text("ios.limitation.relay_without_internet")
                                    .font(DesignSystem.Typography.footnote)
                                    .foregroundStyle(DesignSystem.Colors.textSecondary)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                    
                    if appModel.relayDiagnostics.relayDeliveredCount > 0 {
                        SOSCard {
                            HStack(spacing: DesignSystem.Spacing.sm) {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.system(size: 24))
                                    .foregroundStyle(DesignSystem.Colors.successGreen)
                                    .accessibilityHidden(true)
                                Text(relayDeliveredCountText(count: appModel.relayDiagnostics.relayDeliveredCount))
                                    .font(DesignSystem.Typography.callout)
                                    .foregroundStyle(DesignSystem.Colors.textPrimary)
                            }
                        }
                        .accessibilityLabel(Text(relayDeliveredCountText(count: appModel.relayDiagnostics.relayDeliveredCount)))
                    }
                    
                    diagnosticsSection

                    infoSection
                }
                .padding(DesignSystem.Spacing.md)
            }
            .background(DesignSystem.Colors.cardBackgroundSecondary.ignoresSafeArea())
            .navigationTitle("relay.title")
            .onAppear { appModel.refreshRelayDiagnostics() }
        }
    }
    
    private var headerSection: some View {
        VStack(spacing: DesignSystem.Spacing.sm) {
            Image(systemName: "dot.radiowaves.left.and.right")
                .font(.system(size: 48))
                .foregroundStyle(DesignSystem.Colors.accentBlue)
            Text("relay.title")
                .font(DesignSystem.Typography.title2)
                .foregroundStyle(DesignSystem.Colors.textPrimary)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, DesignSystem.Spacing.md)
    }
    
    private var diagnosticsSection: some View {
        let diag = appModel.relayDiagnostics
        return SOSCard {
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                Text("relay.diag.title")
                    .font(DesignSystem.Typography.headline)
                    .foregroundStyle(DesignSystem.Colors.textPrimary)
                diagnosticRow("relay.diag.bluetooth", Text(bluetoothKey(diag.bluetooth)))
                diagnosticRow("relay.diag.scanning", Text(yesNoKey(diag.scanning)))
                diagnosticRow("relay.diag.advertising", Text(yesNoKey(diag.advertising)))
                diagnosticRow("relay.diag.peers", Text("\(diag.peersSeen)"))
                diagnosticRow("relay.diag.connected", Text("\(diag.connectedPeers)"))
                diagnosticRow("relay.diag.last_sent", timeText(diag.lastSentAtMs))
                diagnosticRow("relay.diag.last_received", timeText(diag.lastReceivedAtMs))
                diagnosticRow("relay.diag.pending", Text("\(diag.pendingForward)"))
                diagnosticRow("relay.diag.forwarded", Text("\(diag.forwardedCount)"))
                diagnosticRow("relay.diag.hops", diag.hopsToGateway <= 8 ? Text(verbatim: "\(diag.hopsToGateway)") : Text("relay.diag.hops.offline"))
                diagnosticRow("relay.diag.mesh_peers", Text("\(diag.meshPeers)"))
                diagnosticRow("relay.diag.carried", Text("\(diag.carriedCopies)"))
                diagnosticRow("relay.diag.tombstones", Text("\(diag.tombstones)"))
                if let code = diag.lastErrorCode {
                    diagnosticRow("relay.diag.last_error", Text(verbatim: code))
                }
                Text("relay.diag.footer")
                    .font(DesignSystem.Typography.footnote)
                    .foregroundStyle(DesignSystem.Colors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityIdentifier("relay.diagnostics")
    }

    private func diagnosticRow(_ label: LocalizedStringKey, _ value: Text) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label)
                .font(DesignSystem.Typography.callout)
                .foregroundStyle(DesignSystem.Colors.textSecondary)
            Spacer()
            value
                .font(DesignSystem.Typography.callout)
                .foregroundStyle(DesignSystem.Colors.textPrimary)
        }
    }

    private func yesNoKey(_ value: Bool) -> LocalizedStringKey {
        value ? "relay.diag.yes" : "relay.diag.no"
    }

    private func bluetoothKey(_ state: BleAuthorizationSnapshot) -> LocalizedStringKey {
        switch state {
        case .poweredOn: return "relay.diag.bt.on"
        case .poweredOff: return "relay.diag.bt.off"
        case .unauthorized: return "relay.diag.bt.unauthorized"
        case .unsupported: return "relay.diag.bt.unsupported"
        case .unknown: return "relay.diag.bt.unknown"
        }
    }

    private func timeText(_ ms: Int64?) -> Text {
        guard let ms else { return Text("relay.diag.none") }
        return Text(Date(timeIntervalSince1970: TimeInterval(ms) / 1000), style: .relative)
    }
    
    private func relayDeliveredCountText(count: Int) -> String {
        let key = count == 1 ? "relay.delivered.count.one" : "relay.delivered.count.other"
        if count == 1 {
            return NSLocalizedString(key, comment: "")
        } else {
            return String(format: NSLocalizedString(key, comment: ""), count)
        }
    }

    private var infoSection: some View {
        SOSCard {
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                HStack(spacing: DesignSystem.Spacing.xs) {
                    Image(systemName: "info.circle.fill")
                        .foregroundStyle(DesignSystem.Colors.accentBlue)
                    Text("relay.how_it_works")
                        .font(DesignSystem.Typography.headline)
                        .foregroundStyle(DesignSystem.Colors.textPrimary)
                }
                Text("help.relay.body")
                    .font(DesignSystem.Typography.callout)
                    .foregroundStyle(DesignSystem.Colors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

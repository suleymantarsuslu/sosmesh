import SwiftUI

struct RootTabView: View {
    @EnvironmentObject private var appModel: AppModel
    @AppStorage("sosmesh.disclaimer.accepted") private var storedDisclaimer = false
    @AppStorage("sosmesh.profile.onboarding.done") private var profileOnboardingDone = false
    @State private var selectedTab = 0
    @State private var showRelayRequestAlert = false

    var body: some View {
        Group {
            if !(storedDisclaimer || appModel.acceptedDisclaimer) {
                OnboardingDisclaimerView(onAccept: {
                    storedDisclaimer = true
                    appModel.acceptedDisclaimer = true
                    Task { await appModel.refreshPermissionGate() }
                })
            } else if !appModel.permissionGateCleared {
                PermissionGateView()
            } else if !profileOnboardingDone {
                // After notification permission: optional profile, skippable, 112 visible.
                ProfileOnboardingView(onFinish: { profileOnboardingDone = true })
            } else {
                TabView(selection: $selectedTab) {
                    HomeView(navigateToStatus: { selectedTab = 1 })
                        .tabItem { Label("nav.home", systemImage: "house") }
                        .tag(0)
                    StatusView()
                        .tabItem { Label("nav.status", systemImage: "chart.line.uptrend.xyaxis") }
                        .tag(1)
                    RelayView()
                        .tabItem { Label("nav.relay", systemImage: "dot.radiowaves.left.and.right") }
                        .tag(2)
                    SettingsView()
                        .tabItem { Label("nav.settings", systemImage: "gearshape") }
                        .tag(3)
                }
                .onReceive(NotificationCenter.default.publisher(for: .navigateToStatusTab)) { _ in
                    selectedTab = 1
                }
                .onReceive(NotificationCenter.default.publisher(for: .navigateToRelayTab)) { _ in
                    selectedTab = 2
                }
            }
        }
        .onAppear {
            appModel.bootstrap()
        }
    }
}

import SwiftUI

struct RootTabView: View {
    @EnvironmentObject private var appModel: AppModel
    @AppStorage("sosmesh.disclaimer.accepted") private var storedDisclaimer = false

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
            } else {
                TabView {
                    HomeView()
                        .tabItem { Label("nav.home", systemImage: "house") }
                    StatusView()
                        .tabItem { Label("nav.status", systemImage: "chart.line.uptrend.xyaxis") }
                    RelayView()
                        .tabItem { Label("nav.relay", systemImage: "dot.radiowaves.left.and.right") }
                    SettingsView()
                        .tabItem { Label("nav.settings", systemImage: "gearshape") }
                }
            }
        }
        .onAppear {
            appModel.bootstrap()
        }
    }
}

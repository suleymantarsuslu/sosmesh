import SwiftUI

struct RootTabView: View {
    @EnvironmentObject private var appModel: AppModel
    @AppStorage("sosmesh.disclaimer.accepted") private var storedDisclaimer = false

    var body: some View {
        Group {
            if storedDisclaimer || appModel.acceptedDisclaimer {
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
            } else {
                OnboardingDisclaimerView(onAccept: {
                    storedDisclaimer = true
                    appModel.acceptedDisclaimer = true
                })
            }
        }
        .onAppear {
            appModel.bootstrap()
        }
    }
}

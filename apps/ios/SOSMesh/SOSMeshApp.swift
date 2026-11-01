import SwiftUI

@main
struct SOSMeshApp: App {
    @StateObject private var appModel = AppModel()
    @StateObject private var watchCompanion = PhoneWatchCompanionHolder()

    var body: some Scene {
        WindowGroup {
            RootTabView()
                .environmentObject(appModel)
                .onAppear {
                    watchCompanion.activateIfNeeded()
                }
        }
    }
}

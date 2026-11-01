import SwiftUI

@main
struct SOSMeshApp: App {
    @StateObject private var appModel = AppModel()

    var body: some Scene {
        WindowGroup {
            RootTabView()
                .environmentObject(appModel)
        }
    }
}

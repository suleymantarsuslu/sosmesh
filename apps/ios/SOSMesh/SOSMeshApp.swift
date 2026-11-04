import SwiftUI

@main
struct SOSMeshApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var appModel = AppModel()
    @StateObject private var watchCompanion = PhoneWatchCompanionHolder()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootTabView()
                .environmentObject(appModel)
                .onAppear {
                    watchCompanion.activateIfNeeded()
                    appDelegate.appModel = appModel
                }
                .onChange(of: scenePhase) { _, newPhase in
                    switch newPhase {
                    case .active:
                        appModel.noteEnteredForeground()
                    case .background:
                        appModel.noteEnteredBackground()
                    default:
                        break
                    }
                }
        }
    }
}

class AppDelegate: NSObject, UIApplicationDelegate {
    weak var appModel: AppModel?
    
    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        appModel?.didRegisterForRemoteNotifications(token: deviceToken)
    }
    
    func application(
        _ application: UIApplication,
        didReceiveRemoteNotification userInfo: [AnyHashable: Any],
        fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        appModel?.didReceiveRemoteNotification(userInfo: userInfo)
        completionHandler(.newData)
    }
}

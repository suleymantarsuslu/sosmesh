import Foundation

@MainActor
final class PhoneWatchCompanionHolder: ObservableObject {
    private var manager: PhoneWatchSessionManager?
    private var didActivate = false

    func activateIfNeeded() {
        guard !didActivate else { return }
        didActivate = true
        guard let session = try? PhoneWatchCompanionBootstrap.makeSessionManager(
            sourceRoot: PhoneWatchCompanionBootstrap.resolveSourceRoot()
        ) else {
            return
        }
        manager = session
        session.activate()
    }
}

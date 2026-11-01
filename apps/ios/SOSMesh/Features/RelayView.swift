import SwiftUI

struct RelayView: View {
    @EnvironmentObject private var appModel: AppModel

    var body: some View {
        NavigationStack {
            Form {
                Toggle(isOn: $appModel.relayEnabled) {
                    Text("relay.toggle.on")
                }
                .accessibilityLabel(Text("relay.toggle.aria"))
                Text("relay.description")
                Text("relay.warning")
                    .foregroundStyle(.orange)
                Text("ios.limitation.relay_without_internet")
                    .font(.footnote)
            }
            .navigationTitle("relay.title")
        }
    }
}

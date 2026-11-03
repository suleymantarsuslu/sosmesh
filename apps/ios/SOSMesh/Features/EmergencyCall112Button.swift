import SwiftUI

struct EmergencyCall112Button: View {
    var body: some View {
        Link(destination: EmergencyCall112Link.url) {
            Text("gate.action.call112")
                .frame(maxWidth: .infinity)
                .padding()
        }
        .buttonStyle(.borderedProminent)
        .tint(.blue)
        .accessibilityLabel(Text("gate.action.call112"))
        .accessibilityHint(Text("gate.action.call112.hint"))
    }
}

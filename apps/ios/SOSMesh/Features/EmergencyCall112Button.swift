import SwiftUI

struct EmergencyCall112Button: View {
    var body: some View {
        let emergencyNumber = EmergencyNumberProvider.getEmergencyNumber()
        Link(destination: EmergencyCall112Link.url) {
            Text(String(format: NSLocalizedString("gate.action.call112", comment: ""), emergencyNumber))
                .frame(maxWidth: .infinity)
                .padding()
        }
        .buttonStyle(.borderedProminent)
        .tint(.blue)
        .accessibilityLabel(Text(String(format: NSLocalizedString("gate.action.call112", comment: ""), emergencyNumber)))
        .accessibilityHint(Text(String(format: NSLocalizedString("gate.action.call112.hint", comment: ""), emergencyNumber)))
    }
}

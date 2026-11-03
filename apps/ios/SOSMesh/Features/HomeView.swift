import SwiftUI
import UIKit

struct HomeView: View {
    @EnvironmentObject private var appModel: AppModel

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text("app.tagline")
                    .font(.title2)
                    .accessibilityAddTraits(.isHeader)
                Text("onboarding.not112")
                    .font(.body)
                    .accessibilityLabel(Text("onboarding.not112"))
                EmergencyCall112Button()
                CrossPlatformFaultBanner(hint: appModel.platformHint, onOpenSettings: openSettings)
                NavigationLink {
                    SosSendView()
                } label: {
                    Text("sos.button.label")
                        .font(.title)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.red.opacity(0.85))
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .accessibilityHint(Text("sos.button.aria"))
            }
            .padding()
            .navigationTitle("app.name")
            .task {
                await appModel.reloadOutbox()
            }
        }
    }

    private func openSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
        }
    }
}

struct SosSendView: View {
    @EnvironmentObject private var appModel: AppModel
    @State private var note = ""
    @State private var sending = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 12) {
            Text("sos.confirm.message")
            TextField("sos.note.placeholder", text: $note)
                .textFieldStyle(.roundedBorder)
            Button("sos.confirm.yes") {
                Task { await send() }
            }
            .buttonStyle(.borderedProminent)
            .disabled(sending)
            if sending {
                ProgressView()
            }
            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }
        }
        .padding()
        .navigationTitle("sos.confirm.title")
    }

    private func send() async {
        sending = true
        errorMessage = nil
        defer { sending = false }
        do {
            let lang = Locale.current.language.languageCode?.identifier ?? "en"
            try await appModel.submitSos(note: note, languageTag: lang)
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }
}

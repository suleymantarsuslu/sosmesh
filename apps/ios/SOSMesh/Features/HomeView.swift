import SwiftUI

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
                CrossPlatformFaultBanner(hint: appModel.platformHint, onOpenSettings: {})
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
            .onAppear {
                appModel.refreshPlatformHint()
            }
        }
    }
}

struct SosSendView: View {
    @EnvironmentObject private var appModel: AppModel
    @State private var queued = false

    var body: some View {
        VStack(spacing: 12) {
            Text("sos.confirm.message")
            Button("sos.confirm.yes") {
                queued = true
                appModel.outboxCount += 1
            }
            .buttonStyle(.borderedProminent)
            if queued {
                Text("status.timeline.1")
                    .accessibilityLabel(Text("status.timeline.1"))
            }
        }
        .padding()
        .navigationTitle("sos.confirm.title")
    }
}

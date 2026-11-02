import SwiftUI
import SOSMeshCore

struct WatchRootView: View {
    @EnvironmentObject private var model: WatchAppModel

    var body: some View {
        NavigationStack {
            VStack(spacing: 8) {
                Text(model.headline)
                    .font(.headline)
                    .accessibilityAddTraits(.isHeader)
                Text(model.detail)
                    .font(.caption2)
                    .multilineTextAlignment(.center)
                if !model.connectivityHeadline.isEmpty {
                    Text(model.connectivityHeadline)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                sosButton
                if model.confirmStep == .confirmDialog {
                    confirmButtons
                }
                NavigationLink("Bağlantı yardımı") {
                    WatchOfflineHelpView()
                }
                .font(.caption2)
            }
            .padding()
        }
        .onAppear { model.onAppear() }
    }

    private var sosButton: some View {
        Button {
            // press handled via gesture
        } label: {
            Text("SOS")
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
        }
        .buttonStyle(.borderedProminent)
        .tint(.red)
        .accessibilityLabel("Acil SOS")
        .accessibilityHint("Basılı tutun, bırakın, ardından onaylayın")
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in model.onSosPressStart() }
                .onEnded { _ in model.onSosPressRelease() }
        )
    }

    private var confirmButtons: some View {
        HStack {
            Button("İptal") { model.onConfirmCancel() }
            Button("Gönder") { model.onConfirmSend() }
                .tint(.red)
        }
    }
}

struct WatchOfflineHelpView: View {
    private let copy = WatchCapabilityMatrix.phoneNotReachableCopy(language: "tr")

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 6) {
                Text(copy.headline)
                    .font(.headline)
                Text(copy.detail)
                    .font(.caption2)
                Text("112 yerine geçmez.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Offline")
    }
}

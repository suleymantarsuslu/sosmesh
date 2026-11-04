import SwiftUI
import SOSMeshCore

struct WatchRootView: View {
    @EnvironmentObject private var model: WatchAppModel
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 6) {
                    Image("WatchLogo")
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(height: 32)
                        .accessibilityLabel("SOSMesh")
                        .padding(.bottom, 4)
                    
                    Text(model.headline)
                        .font(.headline)
                        .multilineTextAlignment(.center)
                        .accessibilityAddTraits(.isHeader)
                    
                    Text(model.detail)
                        .font(.caption2)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.secondary)

                    if !model.meshHandoffStatus.isEmpty {
                        Text(model.meshHandoffStatus)
                            .font(.caption2)
                            .multilineTextAlignment(.center)
                    }
                    
                    if !model.connectivityHeadline.isEmpty {
                        HStack(spacing: 4) {
                            Image(systemName: "iphone")
                                .font(.system(size: 10))
                            Text(model.connectivityHeadline)
                                .font(.caption2)
                        }
                        .foregroundStyle(.secondary)
                        .padding(.top, 2)
                    }
                    
                    sosButton
                    
                    if model.confirmStep == .confirmDialog {
                        confirmButtons
                    }
                    
                    NavigationLink {
                        WatchOfflineHelpView()
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "info.circle")
                            Text("watch.help.link")
                        }
                        .font(.caption2)
                        .foregroundStyle(.blue)
                    }
                }
                .padding(8)
            }
        }
        .onAppear { model.onAppear() }
        .onDisappear { model.onDisappear() }
    }

    private var sosButton: some View {
        Button {
            // press handled via gesture
        } label: {
            HStack(spacing: 4) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 16, weight: .bold))
                Text("SOS")
                    .font(.system(size: 20, weight: .bold, design: .rounded))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
        }
        .buttonStyle(.plain)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(
                    LinearGradient(
                        colors: [Color.red, Color.red.opacity(0.85)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
        )
        .accessibilityLabel(Text("watch.sos.label"))
        .accessibilityHint(Text("watch.sos.hint"))
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in model.onSosPressStart() }
                .onEnded { _ in model.onSosPressRelease() }
        )
    }

    private var confirmButtons: some View {
        VStack(spacing: 6) {
            Button {
                model.onConfirmSend()
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "paperplane.fill")
                    Text("watch.confirm.send")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(.red)
            
            Button("watch.confirm.cancel") {
                model.onConfirmCancel()
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
        }
    }
}

struct WatchOfflineHelpView: View {
    private let copy = WatchCapabilityMatrix.phoneNotReachableCopy(language: "tr")

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Image("WatchLogo")
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(height: 24)
                    .padding(.bottom, 4)
                
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 4) {
                        Image(systemName: "iphone.slash")
                            .font(.system(size: 14))
                            .foregroundStyle(.orange)
                        Text(copy.headline)
                            .font(.headline)
                    }
                    
                    Text(copy.detail)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 4) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.system(size: 12))
                            .foregroundStyle(.red)
                        Text("onboarding.not112")
                            .font(.caption2)
                            .fontWeight(.semibold)
                    }
                    
                    Text("watch.offline.emergency_warning")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 4)
            }
            .padding(8)
        }
        .navigationTitle(Text("watch.help.title"))
    }
}

import SwiftUI
import UIKit

struct HomeView: View {
    @EnvironmentObject private var appModel: AppModel
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: DesignSystem.Spacing.lg) {
                    headerSection
                    disclaimerCard
                    CrossPlatformFaultBanner(hint: appModel.platformHint, onOpenSettings: openSettings)
                    sosButtonSection
                    quickStatsCard
                }
                .padding(DesignSystem.Spacing.md)
            }
            .background(DesignSystem.Colors.cardBackgroundSecondary.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    HStack(spacing: DesignSystem.Spacing.xs) {
                        Image("SOSMeshLogo")
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(height: 32)
                            .accessibilityHidden(true)
                        Text("app.name")
                            .font(DesignSystem.Typography.headline)
                    }
                }
            }
            .task {
                await appModel.reloadOutbox()
            }
        }
    }
    
    private var headerSection: some View {
        VStack(spacing: DesignSystem.Spacing.xs) {
            Image("SOSMeshLogoLarge")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(height: 80)
                .accessibilityLabel(Text("app.name"))
            Text("app.tagline")
                .font(DesignSystem.Typography.title2)
                .foregroundStyle(DesignSystem.Colors.textPrimary)
                .multilineTextAlignment(.center)
                .accessibilityAddTraits(.isHeader)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, DesignSystem.Spacing.md)
    }
    
    private var disclaimerCard: some View {
        SOSCard {
            HStack(spacing: DesignSystem.Spacing.sm) {
                Image(systemName: "info.circle.fill")
                    .font(.system(size: 24))
                    .foregroundStyle(DesignSystem.Colors.accentBlue)
                    .accessibilityHidden(true)
                Text("onboarding.not112")
                    .font(DesignSystem.Typography.callout)
                    .foregroundStyle(DesignSystem.Colors.textPrimary)
            }
        }
        .accessibilityLabel(Text("onboarding.not112"))
    }
    
    private var sosButtonSection: some View {
        VStack(spacing: DesignSystem.Spacing.md) {
            NavigationLink {
                SosSendView()
            } label: {
                HStack(spacing: DesignSystem.Spacing.sm) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 28, weight: .bold))
                    Text("sos.button.label")
                        .font(DesignSystem.Typography.largeTitle)
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, DesignSystem.Spacing.lg)
                .background(
                    RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.lg)
                        .fill(
                            LinearGradient(
                                colors: [
                                    DesignSystem.Colors.emergencyRed,
                                    DesignSystem.Colors.emergencyRed.opacity(0.85)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                )
                .shadow(color: DesignSystem.Colors.emergencyRed.opacity(0.4), radius: 12, x: 0, y: 6)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(Text("sos.button.label"))
            .accessibilityHint(Text("sos.button.aria"))
            
            Link(destination: URL(string: "tel:112")!) {
                HStack(spacing: DesignSystem.Spacing.xs) {
                    Image(systemName: "phone.fill")
                    Text("gate.action.call112")
                }
                .font(DesignSystem.Typography.headline)
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, DesignSystem.Spacing.sm)
                .background(
                    RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                        .fill(DesignSystem.Colors.accentBlue)
                )
            }
            .accessibilityLabel(Text("gate.action.call112"))
            .accessibilityHint(Text("gate.action.call112.hint"))
        }
    }
    
    private var quickStatsCard: some View {
        SOSCard {
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
                Label("status.title", systemImage: "chart.line.uptrend.xyaxis")
                    .font(DesignSystem.Typography.headline)
                    .foregroundStyle(DesignSystem.Colors.textPrimary)
                
                if appModel.outboxCount > 0 {
                    HStack {
                        Image(systemName: "envelope.fill")
                            .foregroundStyle(DesignSystem.Colors.accentBlue)
                        Text("\(appModel.outboxCount) message\(appModel.outboxCount == 1 ? "" : "s") in outbox")
                            .font(DesignSystem.Typography.callout)
                            .foregroundStyle(DesignSystem.Colors.textSecondary)
                    }
                } else {
                    Text("status.empty")
                        .font(DesignSystem.Typography.callout)
                        .foregroundStyle(DesignSystem.Colors.textSecondary)
                }
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
    @State private var selectedPhoto: UIImage?
    @State private var showPhotoPicker = false
    @State private var showCamera = false
    @State private var isRecording = false
    @State private var recordingDuration: TimeInterval = 0
    @State private var recordedAudio: Data?
    @State private var uploadToken: String?
    @State private var attachmentStatus: AttachmentStatus = .none
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(spacing: DesignSystem.Spacing.lg) {
                VStack(spacing: DesignSystem.Spacing.md) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 64))
                        .foregroundStyle(DesignSystem.Colors.emergencyRed)
                    
                    Text("sos.confirm.title")
                        .font(DesignSystem.Typography.largeTitle)
                        .foregroundStyle(DesignSystem.Colors.textPrimary)
                    
                    Text("sos.confirm.message")
                        .font(DesignSystem.Typography.callout)
                        .foregroundStyle(DesignSystem.Colors.textSecondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.top, DesignSystem.Spacing.lg)
                
                SOSCard {
                    VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                        Text("sos.note.placeholder")
                            .font(DesignSystem.Typography.caption1)
                            .foregroundStyle(DesignSystem.Colors.textSecondary)
                        TextField("", text: $note, axis: .vertical)
                            .textFieldStyle(.plain)
                            .font(DesignSystem.Typography.body)
                            .lineLimit(3...6)
                    }
                }
                
                if selectedPhoto != nil || recordedAudio != nil {
                    SOSCard {
                        VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
                            if let photo = selectedPhoto {
                                HStack {
                                    Image(systemName: "photo")
                                        .foregroundStyle(DesignSystem.Colors.accentBlue)
                                    Text("Photo attached")
                                        .font(DesignSystem.Typography.callout)
                                    Spacer()
                                    statusIcon
                                }
                            }
                            if recordedAudio != nil {
                                HStack {
                                    Image(systemName: "mic.fill")
                                        .foregroundStyle(DesignSystem.Colors.accentBlue)
                                    Text(String(format: "sos.voice.duration", formatDuration(recordingDuration)))
                                        .font(DesignSystem.Typography.callout)
                                    Spacer()
                                    statusIcon
                                }
                            }
                        }
                    }
                }
                
                if !isRecording {
                    HStack(spacing: DesignSystem.Spacing.sm) {
                        Button {
                            showPhotoPicker = true
                        } label: {
                            HStack {
                                Image(systemName: "photo")
                                Text("sos.attach.photo")
                            }
                            .font(DesignSystem.Typography.callout)
                            .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                        .disabled(sending)
                        
                        Button {
                            startRecording()
                        } label: {
                            HStack {
                                Image(systemName: "mic")
                                Text("sos.attach.voice")
                            }
                            .font(DesignSystem.Typography.callout)
                            .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                        .disabled(sending || recordedAudio != nil)
                    }
                } else {
                    SOSCard(highlighted: true) {
                        VStack(spacing: DesignSystem.Spacing.sm) {
                            HStack {
                                Image(systemName: "waveform")
                                    .foregroundStyle(DesignSystem.Colors.emergencyRed)
                                Text("sos.voice.recording")
                                    .font(DesignSystem.Typography.headline)
                                Spacer()
                                Text(formatDuration(recordingDuration))
                                    .font(DesignSystem.Typography.callout)
                                    .foregroundStyle(DesignSystem.Colors.textSecondary)
                            }
                            HStack(spacing: DesignSystem.Spacing.sm) {
                                Button {
                                    stopRecording(save: true)
                                } label: {
                                    Text("sos.voice.stop")
                                        .frame(maxWidth: .infinity)
                                }
                                .buttonStyle(.bordered)
                                
                                Button {
                                    stopRecording(save: false)
                                } label: {
                                    Text("sos.voice.delete")
                                        .frame(maxWidth: .infinity)
                                }
                                .buttonStyle(.bordered)
                                .tint(.red)
                            }
                        }
                    }
                }
                
                VStack(spacing: DesignSystem.Spacing.sm) {
                    PrimaryButton("sos.confirm.yes", icon: "paperplane.fill", isDestructive: true) {
                        Task { await send() }
                    }
                    .disabled(sending || isRecording)
                    
                    if sending {
                        HStack(spacing: DesignSystem.Spacing.xs) {
                            ProgressView()
                                .tint(DesignSystem.Colors.accentBlue)
                            Text("sos.sending")
                                .font(DesignSystem.Typography.callout)
                                .foregroundStyle(DesignSystem.Colors.textSecondary)
                        }
                        .padding(.vertical, DesignSystem.Spacing.sm)
                    }
                    
                    if let errorMessage {
                        SOSCard(highlighted: true) {
                            HStack(spacing: DesignSystem.Spacing.xs) {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundStyle(DesignSystem.Colors.emergencyRed)
                                Text(errorMessage)
                                    .font(DesignSystem.Typography.callout)
                                    .foregroundStyle(DesignSystem.Colors.textPrimary)
                            }
                        }
                    }
                }
            }
            .padding(DesignSystem.Spacing.md)
        }
        .background(DesignSystem.Colors.cardBackgroundSecondary.ignoresSafeArea())
        .navigationTitle("sos.confirm.title")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showPhotoPicker) {
            PhotoPickerView(selectedImage: $selectedPhoto)
        }
    }
    
    private var statusIcon: some View {
        Group {
            switch attachmentStatus {
            case .none:
                EmptyView()
            case .uploading:
                ProgressView()
                    .scaleEffect(0.7)
            case .uploaded:
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(.green)
            case .failed:
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(.red)
            }
        }
    }

    private func send() async {
        sending = true
        errorMessage = nil
        defer { sending = false }
        do {
            let lang = Locale.current.language.languageCode?.identifier ?? "en"
            try await appModel.submitSos(note: note, languageTag: lang)
            
            if let token = appModel.lastUploadToken, (selectedPhoto != nil || recordedAudio != nil) {
                uploadToken = token
                await uploadAttachments()
            }
            
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
    
    private func uploadAttachments() async {
        guard let token = uploadToken else { return }
        attachmentStatus = .uploading
        
        let baseURL = IngestConfig.production(deviceId: "").baseURL
        let config = AttachmentUploadConfig(baseURL: baseURL, uploadToken: token)
        let uploader = AttachmentUploader(config: config)
        
        if let photo = selectedPhoto, let imageData = photo.jpegData(compressionQuality: 0.8) {
            let result = await uploader.upload(kind: .image, data: imageData, mimeType: "image/jpeg")
            switch result {
            case .success:
                attachmentStatus = .uploaded
            case .noNetwork, .httpError, .error:
                attachmentStatus = .failed
            }
        }
        
        if let audioData = recordedAudio {
            let result = await uploader.upload(kind: .audio, data: audioData, mimeType: "audio/aac")
            switch result {
            case .success:
                attachmentStatus = .uploaded
            case .noNetwork, .httpError, .error:
                attachmentStatus = .failed
            }
        }
    }
    
    private func startRecording() {
        isRecording = true
        recordingDuration = 0
        Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { timer in
            if isRecording {
                recordingDuration += 1
                if recordingDuration >= 600 {
                    timer.invalidate()
                    stopRecording(save: true)
                }
            } else {
                timer.invalidate()
            }
        }
    }
    
    private func stopRecording(save: Bool) {
        isRecording = false
        if save {
            recordedAudio = Data()
        } else {
            recordingDuration = 0
        }
    }
    
    private func formatDuration(_ seconds: TimeInterval) -> String {
        let minutes = Int(seconds) / 60
        let secs = Int(seconds) % 60
        return String(format: "%d:%02d", minutes, secs)
    }
}

enum AttachmentStatus {
    case none
    case uploading
    case uploaded
    case failed
}

struct PhotoPickerView: UIViewControllerRepresentable {
    @Binding var selectedImage: UIImage?
    @Environment(\.dismiss) private var dismiss
    
    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.delegate = context.coordinator
        picker.sourceType = .photoLibrary
        return picker
    }
    
    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: PhotoPickerView
        
        init(_ parent: PhotoPickerView) {
            self.parent = parent
        }
        
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]) {
            if let image = info[.originalImage] as? UIImage {
                parent.selectedImage = image
            }
            parent.dismiss()
        }
        
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}

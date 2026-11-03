import SwiftUI
import UIKit
import PhotosUI
import SOSMeshCore

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
    @State private var showCameraPicker = false
    @StateObject private var voiceRecorder = VoiceRecorder()
    @StateObject private var audioPlayer = AudioPlayer()
    @State private var attachmentStatuses: [String: AttachmentUploadStatus] = [:]
    @State private var attachmentIds: [String] = []
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
                
                if selectedPhoto != nil || voiceRecorder.recordedURL != nil {
                    SOSCard {
                        VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
                            if let photo = selectedPhoto {
                                HStack(spacing: DesignSystem.Spacing.sm) {
                                    Image(uiImage: photo)
                                        .resizable()
                                        .scaledToFill()
                                        .frame(width: 60, height: 60)
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                    VStack(alignment: .leading) {
                                        Text("Photo")
                                            .font(DesignSystem.Typography.callout)
                                        statusText(for: "photo")
                                            .font(DesignSystem.Typography.caption1)
                                            .foregroundStyle(DesignSystem.Colors.textSecondary)
                                    }
                                    Spacer()
                                    Button {
                                        selectedPhoto = nil
                                    } label: {
                                        Image(systemName: "xmark.circle.fill")
                                            .foregroundStyle(.gray)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            if voiceRecorder.recordedURL != nil {
                                HStack(spacing: DesignSystem.Spacing.sm) {
                                    Image(systemName: "waveform")
                                        .font(.system(size: 32))
                                        .foregroundStyle(DesignSystem.Colors.accentBlue)
                                        .frame(width: 60, height: 60)
                                    VStack(alignment: .leading) {
                                        Text(String(format: NSLocalizedString("sos.voice.duration", comment: ""), formatDuration(voiceRecorder.duration)))
                                            .font(DesignSystem.Typography.callout)
                                        statusText(for: "audio")
                                            .font(DesignSystem.Typography.caption1)
                                            .foregroundStyle(DesignSystem.Colors.textSecondary)
                                    }
                                    Spacer()
                                    Button {
                                        if audioPlayer.isPlaying {
                                            audioPlayer.stop()
                                        } else if let url = voiceRecorder.recordedURL {
                                            try? audioPlayer.play(url: url)
                                        }
                                    } label: {
                                        Image(systemName: audioPlayer.isPlaying ? "stop.circle.fill" : "play.circle.fill")
                                            .font(.system(size: 24))
                                            .foregroundStyle(DesignSystem.Colors.accentBlue)
                                    }
                                    .buttonStyle(.plain)
                                    Button {
                                        voiceRecorder.deleteRecording()
                                    } label: {
                                        Image(systemName: "trash.circle.fill")
                                            .foregroundStyle(.red)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                }
                
                if !voiceRecorder.isRecording {
                    VStack(spacing: DesignSystem.Spacing.xs) {
                        HStack(spacing: DesignSystem.Spacing.sm) {
                            Menu {
                                Button {
                                    showPhotoPicker = true
                                } label: {
                                    Label("Gallery", systemImage: "photo.on.rectangle")
                                }
                                Button {
                                    showCameraPicker = true
                                } label: {
                                    Label("Camera", systemImage: "camera")
                                }
                            } label: {
                                HStack {
                                    Image(systemName: "photo")
                                    Text("sos.attach.photo")
                                }
                                .font(DesignSystem.Typography.callout)
                                .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.bordered)
                            .disabled(sending || selectedPhoto != nil)
                            
                            Button {
                                Task {
                                    let granted = await voiceRecorder.requestPermission()
                                    if granted {
                                        try? voiceRecorder.startRecording()
                                    } else {
                                        errorMessage = "Microphone permission required"
                                    }
                                }
                            } label: {
                                HStack {
                                    Image(systemName: "mic")
                                    Text("sos.attach.voice")
                                }
                                .font(DesignSystem.Typography.callout)
                                .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.bordered)
                            .disabled(sending || voiceRecorder.recordedURL != nil)
                        }
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
                                Text(formatDuration(voiceRecorder.duration))
                                    .font(DesignSystem.Typography.callout)
                                    .foregroundStyle(DesignSystem.Colors.textSecondary)
                            }
                            HStack(spacing: DesignSystem.Spacing.sm) {
                                Button {
                                    voiceRecorder.stopRecording(save: true)
                                } label: {
                                    Text("sos.voice.stop")
                                        .frame(maxWidth: .infinity)
                                }
                                .buttonStyle(.bordered)
                                
                                Button {
                                    voiceRecorder.stopRecording(save: false)
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
                    .disabled(sending || voiceRecorder.isRecording)
                    
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
        .photosPicker(isPresented: $showPhotoPicker, selection: Binding(
            get: { nil },
            set: { item in
                Task {
                    if let item = item,
                       let data = try? await item.loadTransferable(type: Data.self),
                       let image = UIImage(data: data) {
                        selectedPhoto = compressImage(image)
                    }
                }
            }
        ))
        .sheet(isPresented: $showCameraPicker) {
            CameraPickerView(selectedImage: Binding(
                get: { selectedPhoto },
                set: { image in
                    if let image = image {
                        selectedPhoto = compressImage(image)
                    }
                }
            ))
        }
    }
    
    private func compressImage(_ image: UIImage) -> UIImage {
        let maxBytes = 15_000_000
        var compression: CGFloat = 0.9
        var data = image.jpegData(compressionQuality: compression)
        
        while let imageData = data, imageData.count > maxBytes && compression > 0.1 {
            compression -= 0.1
            data = image.jpegData(compressionQuality: compression)
        }
        
        if let data = data, data.count <= maxBytes, let compressed = UIImage(data: data) {
            return compressed
        }
        
        return image
    }
    
    private func statusText(for kind: String) -> Text {
        if let status = attachmentStatuses[kind] {
            switch status {
            case .waiting:
                return Text("sos.attach.uploading")
            case .uploading:
                return Text("sos.attach.uploading")
            case .sent:
                return Text("sos.attach.uploaded")
            case .failed:
                return Text("sos.attach.failed")
            }
        }
        return Text("")
    }

    private func send() async {
        sending = true
        errorMessage = nil
        defer { sending = false }
        do {
            let lang = Locale.current.language.languageCode?.identifier ?? "en"
            try await appModel.submitSos(note: note, languageTag: lang)
            
            if let token = appModel.lastUploadToken {
                await queueAttachments(uploadToken: token)
            }
            
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
    
    private func queueAttachments(uploadToken: String) async {
        guard let baseDir = try? FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        ).appendingPathComponent("sosmesh") else {
            return
        }
        
        guard let queue = try? AttachmentQueue(baseDir: baseDir) else {
            return
        }
        
        let sosMessageId = uploadToken.split(separator: ":").first.map(String.init) ?? ""
        
        if let photo = selectedPhoto, let imageData = photo.jpegData(compressionQuality: 0.9) {
            if let queued = try? queue.enqueue(
                sosMessageId: sosMessageId,
                uploadToken: uploadToken,
                kind: .image,
                data: imageData,
                mimeType: "image/jpeg"
            ) {
                attachmentIds.append(queued.id)
                attachmentStatuses["photo"] = .waiting
            }
        }
        
        if let audioURL = voiceRecorder.recordedURL,
           let audioData = try? Data(contentsOf: audioURL) {
            if let queued = try? queue.enqueue(
                sosMessageId: sosMessageId,
                uploadToken: uploadToken,
                kind: .audio,
                data: audioData,
                mimeType: "audio/aac"
            ) {
                attachmentIds.append(queued.id)
                attachmentStatuses["audio"] = .waiting
            }
        }
        
        let baseURL = IngestConfig.production(deviceId: "").baseURL
        let coordinator = AttachmentUploadCoordinator(queue: queue, baseURL: baseURL)
        coordinator.onStatusChange = { [weak self] id, status in
            if self?.attachmentIds.contains(id) == true {
                if id.contains("jpg") {
                    self?.attachmentStatuses["photo"] = status
                } else {
                    self?.attachmentStatuses["audio"] = status
                }
            }
        }
        await coordinator.processQueue()
    }
    
    private func formatDuration(_ seconds: TimeInterval) -> String {
        let minutes = Int(seconds) / 60
        let secs = Int(seconds) % 60
        return String(format: "%d:%02d", minutes, secs)
    }
}

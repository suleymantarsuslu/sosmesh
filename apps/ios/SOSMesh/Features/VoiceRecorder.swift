import Foundation
import AVFoundation

@MainActor
final class VoiceRecorder: NSObject, ObservableObject {
    @Published var isRecording = false
    @Published var duration: TimeInterval = 0
    @Published var recordedURL: URL?
    
    private var audioRecorder: AVAudioRecorder?
    private var timer: Timer?
    private let maxDuration: TimeInterval = 600
    
    func requestPermission() async -> Bool {
        await withCheckedContinuation { continuation in
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                continuation.resume(returning: granted)
            }
        }
    }
    
    func startRecording() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .default)
        try session.setActive(true)
        
        let tempDir = FileManager.default.temporaryDirectory
        let filename = "voice_\(UUID().uuidString).m4a"
        let url = tempDir.appendingPathComponent(filename)
        
        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44100,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue
        ]
        
        audioRecorder = try AVAudioRecorder(url: url, settings: settings)
        audioRecorder?.delegate = self
        audioRecorder?.record()
        
        isRecording = true
        duration = 0
        
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            Task { @MainActor in
                self.duration += 1
                if self.duration >= self.maxDuration {
                    self.stopRecording(save: true)
                }
            }
        }
    }
    
    func stopRecording(save: Bool) {
        timer?.invalidate()
        timer = nil
        isRecording = false
        
        guard let recorder = audioRecorder else { return }
        let url = recorder.url
        recorder.stop()
        
        if save {
            recordedURL = url
        } else {
            try? FileManager.default.removeItem(at: url)
            duration = 0
        }
        
        audioRecorder = nil
        
        try? AVAudioSession.sharedInstance().setActive(false)
    }
    
    func deleteRecording() {
        if let url = recordedURL {
            try? FileManager.default.removeItem(at: url)
            recordedURL = nil
            duration = 0
        }
    }
}

extension VoiceRecorder: AVAudioRecorderDelegate {
    nonisolated func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
        Task { @MainActor in
            if !flag {
                isRecording = false
                timer?.invalidate()
                timer = nil
            }
        }
    }
}

import Foundation

public struct SosInnerV2Context: Sendable {
    public var senderKey: String
    public var seq: UInt32
    public var profile: SosProfile?
    public var profileChanged: Bool
    public var sosType: String
    public var personCount: Int?

    public init(senderKey: String, seq: UInt32, profile: SosProfile?, profileChanged: Bool, sosType: String = "GENERAL", personCount: Int? = nil) {
        self.senderKey = senderKey
        self.seq = seq
        self.profile = profile
        self.profileChanged = profileChanged
        self.sosType = sosType
        self.personCount = personCount
    }
}

/// Encrypted inner payload v2 (sos-inner-payload-v2.schema.json). Never logged.
public struct SosInnerPayloadV2: Encodable, Equatable {
    public struct Location: Encodable, Equatable {
        public var latitude: Double
        public var longitude: Double
        public var accuracyMeters: Double?
        public var timestamp: String
    }

    public var innerVersion = 2
    public var senderKey: String
    public var seq: UInt32
    public var createdAt: String
    public var sosType: String?
    public var note: String?
    public var language: String?
    public var location: Location?
    public var personCount: Int?
    public var profile: SosProfile?
    public var profileChanged: Bool?
}

public enum SosInnerPayloadV2Builder {
    public static let maxNoteBytes = 2000
    public static let maxNoteChars = 1000

    /// Encodes the inner payload within 4096 bytes: the note tail is trimmed first, then the
    /// profile is dropped. An empty SOS (no note, location or profile) is valid.
    public static func encode(context: SosInnerV2Context, note: String?, location: SosInnerPayloadV2.Location?, language: String, createdAt: String) throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        let profile = context.profile?.sanitized()
        var payload = SosInnerPayloadV2(
            senderKey: context.senderKey,
            seq: max(1, context.seq),
            createdAt: createdAt,
            sosType: context.sosType,
            note: note.map { clampNote($0) },
            language: language,
            location: location,
            personCount: context.personCount.flatMap { (1 ... 50).contains($0) ? $0 : nil },
            profile: (profile?.isEmpty ?? true) ? nil : profile,
            profileChanged: (profile?.isEmpty ?? true) ? nil : context.profileChanged
        )
        var data = try encoder.encode(payload)
        while data.count > MeshV2.maxPayloadBytes, let current = payload.note, !current.isEmpty {
            let overflow = data.count - MeshV2.maxPayloadBytes
            payload.note = String(current.prefix(max(0, current.count - max(overflow, 16))))
            data = try encoder.encode(payload)
        }
        if data.count > MeshV2.maxPayloadBytes {
            payload.profile = nil
            payload.profileChanged = nil
            data = try encoder.encode(payload)
        }
        return data
    }

    static func clampNote(_ note: String) -> String {
        var out = String(note.prefix(maxNoteChars))
        while out.utf8.count > maxNoteBytes { out.removeLast() }
        return out
    }
}

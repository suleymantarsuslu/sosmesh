import Foundation
import SOSMeshContracts
import SOSMeshCore

#if DEBUG
enum DevTestCryptoConfig {
    static let keyId = "dev-test-001"
    static let serverPublicKey = "BFu/Jxfj3txqvjTtUW7BTYK3iX0E/ysPPwPNk091o1c="

    static func config() -> CryptoConfig {
        CryptoConfig(keyId: keyId, serverPublicKey: serverPublicKey)
    }
}
#endif

enum SosCryptoConfiguration {
    static func loadComposerConfig() throws -> CryptoConfig {
        #if DEBUG
        return DevTestCryptoConfig.config()
        #else
        return CryptoConfigProvider.makeConfig()
        #endif
    }
}

enum SosCryptoConfigurationError: Error, LocalizedError {
    case releaseEncryptionNotConfigured

    var errorDescription: String? {
        switch self {
        case .releaseEncryptionNotConfigured:
            return NSLocalizedString(
                "sos.error.release_encryption_not_configured",
                bundle: .main,
                comment: "Shown when release build has no SOS encryption keys configured"
            )
        }
    }
}

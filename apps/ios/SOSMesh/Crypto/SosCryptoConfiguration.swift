import Foundation
import SOSMeshContracts

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
        throw SosCryptoConfigurationError.releaseEncryptionNotConfigured
        #endif
    }
}

enum SosCryptoConfigurationError: Error {
    case releaseEncryptionNotConfigured
}

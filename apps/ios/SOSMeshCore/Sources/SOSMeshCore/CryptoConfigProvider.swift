import Foundation
import SOSMeshContracts

public struct CryptoConfigProvider {
    public static func makeConfig() -> CryptoConfig {
        #if DEBUG
        return CryptoConfig(
            keyId: "dev-test-001",
            serverPublicKey: "BFu/Jxfj3txqvjTtUW7BTYK3iX0E/ysPPwPNk091o1c="
        )
        #else
        return CryptoConfig(
            keyId: "prod-2026-11-a",
            serverPublicKey: "njCfeyVCrZmw9xdi9g1sVHBxtDouBDVYq4wJbNO6YnQ="
        )
        #endif
    }
}

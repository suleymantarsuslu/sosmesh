package com.sosmesh.android.core.data.sos

import com.sosmesh.contracts.CryptoConfig

object DevTestCryptoConfig {
    const val KEY_ID = "dev-test-001"
    const val SERVER_PUBLIC_KEY = "BFu/Jxfj3txqvjTtUW7BTYK3iX0E/ysPPwPNk091o1c="

    fun config(): CryptoConfig =
        CryptoConfig(
            keyId = KEY_ID,
            serverPublicKey = SERVER_PUBLIC_KEY,
        )
}

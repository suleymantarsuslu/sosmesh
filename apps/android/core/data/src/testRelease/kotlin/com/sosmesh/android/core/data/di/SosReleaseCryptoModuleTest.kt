package com.sosmesh.android.core.data.di

import org.junit.Assert.assertEquals
import org.junit.Test

class SosReleaseCryptoModuleTest {
    @Test
    fun `release config provides production key ID`() {
        val config = SosReleaseCryptoModule.provideCryptoConfig()

        assertEquals("prod-2026-11-a", config.keyId)
        assertEquals("njCfeyVCrZmw9xdi9g1sVHBxtDouBDVYq4wJbNO6YnQ=", config.serverPublicKey)
    }

    @Test
    fun `release config does not provide private key`() {
        val config = SosReleaseCryptoModule.provideCryptoConfig()

        assertEquals(null, config.serverPrivateKey)
    }
}

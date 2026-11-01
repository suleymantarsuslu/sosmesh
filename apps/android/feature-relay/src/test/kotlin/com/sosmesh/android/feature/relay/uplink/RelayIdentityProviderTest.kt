package com.sosmesh.android.feature.relay.uplink

import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class RelayIdentityProviderTest {
    private val context = ApplicationProvider.getApplicationContext<android.content.Context>()

    @Test
    fun installRelayIdIsStableAnd64HexChars() {
        val first = RelayIdentityProvider(context)
        val second = RelayIdentityProvider(context)
        val id = first.relayIdHex
        assertEquals(id, second.relayIdHex)
        assertEquals(64, id.length)
        assertTrue(id.matches(Regex("^[0-9a-f]{64}$")))
    }
}

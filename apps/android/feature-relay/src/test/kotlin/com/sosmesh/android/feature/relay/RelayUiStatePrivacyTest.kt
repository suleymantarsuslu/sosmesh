package com.sosmesh.android.feature.relay

import com.sosmesh.android.feature.relay.ui.RelayUiState
import org.junit.Assert.assertFalse
import org.junit.Test

class RelayUiStatePrivacyTest {
    @Test
    fun relayUiState_doesNotExposePayloadFields() {
        val forbidden =
            listOf(
                "encrypted",
                "blob",
                "payload",
                "plaintext",
                "decrypt",
                "cipher",
                "note",
            )
        RelayUiState::class.java.declaredFields.forEach { field ->
            val name = field.name.lowercase()
            forbidden.forEach { token ->
                assertFalse("Field ${field.name} must not expose payload content", name.contains(token))
            }
        }
    }
}

package com.sosmesh.android.core.data.sos

import com.sosmesh.android.core.model.SosType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SosMessageComposerTest {
    private val composer = SosMessageComposer(DevTestCryptoConfig.config())

    @Test
    fun compose_producesSchemaValidMessage() {
        val composed =
            composer.compose(
                SosComposeRequest(
                    sosType = SosType.SEL,
                    personCount = 2,
                    note = "sentetik test",
                    location = LocationSnapshot(0.0, 0.0, null, isKnown = false),
                    languageTag = "tr",
                    nowMs = 1_700_000_000_000L,
                ),
            )
        assertEquals(1, composed.message.version)
        assertTrue(composed.message.encryptedPayload.isNotEmpty())
        assertTrue(composed.digest.isNotEmpty())
        assertTrue(composed.encryptedBlobBase64.isNotEmpty())
    }
}

class SosDraftValidatorTest {
    @Test
    fun zeroPersonCount_isInvalid() {
        val result =
            SosDraftValidator.validate(
                SosDraftInput(SosType.DEPREM, "0", false, ""),
            )
        assertTrue(result is SosDraftValidation.Invalid)
    }

    @Test
    fun noteOver200_isInvalid() {
        val result =
            SosDraftValidator.validate(
                SosDraftInput(SosType.DEPREM, "1", false, "x".repeat(201)),
            )
        assertTrue(result is SosDraftValidation.Invalid)
    }
}

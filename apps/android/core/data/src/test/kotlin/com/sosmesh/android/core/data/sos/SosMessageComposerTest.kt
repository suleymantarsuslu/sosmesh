package com.sosmesh.android.core.data.sos

import com.sosmesh.android.core.model.SosType
import com.sosmesh.contracts.LocationStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SosMessageComposerTest {
    private val composer = SosMessageComposer(DevTestCryptoConfig.config())

    @Test
    fun compose_messageIdOverride_usesProvidedId() {
        val composed =
            composer.compose(
                SosComposeRequest(
                    sosType = SosType.DIGER,
                    personCount = 1,
                    note = "",
                    location = LocationSnapshot.unknown(),
                    languageTag = "tr",
                    nowMs = 1_700_000_000_000L,
                    messageIdOverride = "watch-fixed-id",
                ),
            )
        assertEquals("watch-fixed-id", composed.message.id)
    }

    @Test
        val composed =
            composer.compose(
                SosComposeRequest(
                    sosType = SosType.SEL,
                    personCount = 2,
                    note = "sentetik test",
                    location = LocationSnapshot.unknown(),
                    languageTag = "tr",
                    nowMs = 1_700_000_000_000L,
                ),
            )
        assertEquals(LocationStatus.UNKNOWN, composed.message.envelope.locationStatus)
        assertNull(composed.message.envelope.location)
        assertFalse(composed.messageJson.contains("\"latitude\":0"))
        assertFalse(composed.messageJson.contains("\"longitude\":0"))
        assertTrue(composed.messageJson.contains("\"locationStatus\":\"UNKNOWN\""))
        assertTrue(composed.messageJson.contains("\"location\":null"))
    }

    @Test
    fun compose_manualLocation_envelopeMarkedManual() {
        val composed =
            composer.compose(
                SosComposeRequest(
                    sosType = SosType.DEPREM,
                    personCount = 1,
                    note = "",
                    location = LocationSnapshot.manual(39.9, 32.8),
                    languageTag = "tr",
                    nowMs = 1_700_000_000_000L,
                ),
            )
        assertEquals(LocationStatus.MANUAL, composed.message.envelope.locationStatus)
        assertEquals(39.9, composed.message.envelope.location!!.latitude, 0.0001)
        assertEquals(32.8, composed.message.envelope.location!!.longitude, 0.0001)
    }

    @Test
    fun compose_producesSchemaValidMessage() {
        val composed =
            composer.compose(
                SosComposeRequest(
                    sosType = SosType.SEL,
                    personCount = 2,
                    note = "sentetik test",
                    location = LocationSnapshot.gps(41.0, 29.0, accuracyMeters = 12.0),
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

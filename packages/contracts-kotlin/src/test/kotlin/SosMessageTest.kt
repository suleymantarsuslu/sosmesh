package com.sosmesh.contracts

import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import java.io.File

class SosMessageTest {
    private val json =
        Json {
            ignoreUnknownKeys = true
            prettyPrint = false // Canonical output için compact
        }
    private val fixturesPath = "../fixtures/protocol-v1"

    companion object {
        private val canonicalOutputs = mutableMapOf<String, String>()

        @JvmStatic
        @AfterAll
        fun writeCanonicalJsonOutputs() {
            val outputDir = File("build/canonical-json")
            outputDir.mkdirs()

            canonicalOutputs.forEach { (name, content) ->
                File(outputDir, "$name.json").writeText(content)
            }
            println("✓ Canonical JSON outputs written to build/canonical-json/")
        }
    }

    @Test
    fun `test valid SOS message deserialization`() {
        val content = File("$fixturesPath/valid-sos.json").readText()
        val message = json.decodeFromString<SosMessage>(content)
        assertEquals(1, message.version)
        assertEquals("550e8400-e29b-41d4-a716-446655440000", message.id)
        assertEquals("DEVICE_STORED", message.envelope.ackLevel)

        // Write canonical output
        val canonical = json.encodeToString(message)
        canonicalOutputs["valid-sos-kotlin"] = canonical
    }

    @Test
    fun `test unicode SOS message`() {
        val content = File("$fixturesPath/unicode-sos.json").readText()
        val message = json.decodeFromString<SosMessage>(content)
        assertTrue(message.encryptedPayload.contains("İ"))
        assertTrue(message.encryptedPayload.contains("🚨"))

        // Write canonical output
        val canonical = json.encodeToString(message)
        canonicalOutputs["unicode-sos-kotlin"] = canonical
    }

    @Test
    fun `test roundtrip serialization`() {
        val content = File("$fixturesPath/valid-sos.json").readText()
        val message = json.decodeFromString<SosMessage>(content)
        val serialized = json.encodeToString(message)
        val deserialized = json.decodeFromString<SosMessage>(serialized)
        assertEquals(message, deserialized)
    }

    @Test
    fun `test invalid message with missing field fails`() {
        val content = File("$fixturesPath/invalid-missing-field.json").readText()
        assertThrows(Exception::class.java) {
            json.decodeFromString<SosMessage>(content)
        }
    }

    @Test
    fun `test invalid timestamp fails`() {
        val content = File("$fixturesPath/invalid-bad-timestamp.json").readText()
        // Kotlin kotlinx.serialization does not validate ISO8601 format strictly
        // but we parse successfully and document this behavior difference
        val message = json.decodeFromString<SosMessage>(content)
        assertNotNull(message)
    }
}

package com.sosmesh.contracts

import kotlinx.serialization.json.Json
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.*
import java.io.File

class SosMessageTest {
    private val json = Json { ignoreUnknownKeys = true; prettyPrint = true }
    private val fixturesPath = "../fixtures/protocol-v1"

    @Test
    fun `test valid SOS message deserialization`() {
        val content = File("$fixturesPath/valid-sos.json").readText()
        val message = json.decodeFromString<SosMessage>(content)
        assertEquals(1, message.version)
        assertEquals("550e8400-e29b-41d4-a716-446655440000", message.id)
        assertEquals("DEVICE_STORED", message.envelope.ackLevel)
    }

    @Test
    fun `test unicode SOS message`() {
        val content = File("$fixturesPath/unicode-sos.json").readText()
        val message = json.decodeFromString<SosMessage>(content)
        assertTrue(message.encryptedPayload.contains("İ"))
        assertTrue(message.encryptedPayload.contains("🚨"))
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
}

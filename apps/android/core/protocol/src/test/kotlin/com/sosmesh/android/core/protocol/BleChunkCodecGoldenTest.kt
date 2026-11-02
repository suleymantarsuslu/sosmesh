package com.sosmesh.android.core.protocol

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BleChunkCodecGoldenTest {
    @Test
    fun crc32_matchesSharedFixture() {
        val vector = vectorNamed("CRC32 Known Input")
        val input = hexToBytes(vector["input_hex"]!!.jsonPrimitive.content)
        assertEquals(vector["expected_crc32"]!!.jsonPrimitive.long, BleChunkCodec.calculateCrc32(input))
    }

    @Test
    fun sha256_matchesSharedFixture() {
        val vector = vectorNamed("SHA-256 Known Input")
        val input = hexToBytes(vector["input_hex"]!!.jsonPrimitive.content)
        val digestHex = BleChunkCodec.calculateDigest(input).joinToString("") { "%02x".format(it) }
        assertEquals(vector["expected_sha256"]!!.jsonPrimitive.content, digestHex)
    }

    @Test
    fun verifyDigest_rejectsWrongDigest() {
        val message = "TEST_DIGEST_VERIFICATION".toByteArray()
        val wrong = ByteArray(32) { 0xff.toByte() }
        assertFalse(BleChunkCodec.verifyDigest(message, wrong))
    }

    @Test
    fun reassembly_byteEqual_afterSerializeRoundTrip() {
        val message = "SYNTHETIC_TEST_MESSAGE_NO_REAL_PII".toByteArray()
        val chunks = BleChunkCodec.splitIntoChunks(message, 20)
        val reassembled = mutableListOf<Chunk>()
        chunks.forEach { chunk ->
            val wire = BleChunkCodec.serializeChunk(chunk)
            reassembled.add(requireNotNull(BleChunkCodec.deserializeChunk(wire)))
        }
        assertTrue(message.contentEquals(BleChunkCodec.assembleChunks(reassembled)))
    }

    private fun vectorNamed(name: String) =
        fixtureRoot().getValue("vectors").jsonArray.first { entry ->
            entry.jsonObject.getValue("name").jsonPrimitive.content == name
        }.jsonObject

    private fun fixtureRoot() = Json.parseToJsonElement(fixtureText()).jsonObject

    private fun fixtureText(): String {
        val loader = requireNotNull(javaClass.classLoader)
        loader.getResourceAsStream("test-vectors.json")?.bufferedReader()?.use { reader ->
            return reader.readText()
        }
        val moduleDir = java.io.File(System.getProperty("user.dir"))
        val repoFixture =
            moduleDir.resolve("../../../../packages/fixtures/ble/test-vectors.json").canonicalFile
        check(repoFixture.exists()) { "Missing fixture at ${repoFixture.absolutePath}" }
        return repoFixture.readText()
    }

    private fun hexToBytes(hex: String): ByteArray {
        check(hex.length % 2 == 0)
        return ByteArray(hex.length / 2) { i ->
            hex.substring(i * 2, i * 2 + 2).toInt(16).toByte()
        }
    }
}

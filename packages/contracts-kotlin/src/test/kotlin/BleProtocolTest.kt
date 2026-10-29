package com.sosmesh.ble

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.*
import java.io.File

class BleProtocolTest {
    private val testVectors: JsonObject by lazy {
        val testVectorFile = File("../fixtures/ble/test-vectors.json")
        val content = testVectorFile.readText()
        Json.parseToJsonElement(content).jsonObject
    }

    @Test
    fun `test CRC32 with known input`() {
        val vectors = testVectors["vectors"]!!.jsonArray
        val crcVector = vectors.first { 
            it.jsonObject["name"]!!.jsonPrimitive.content == "CRC32 Known Input" 
        }.jsonObject
        
        val inputHex = crcVector["input_hex"]!!.jsonPrimitive.content
        val expectedCRC = crcVector["expected_crc32"]!!.jsonPrimitive.content.toLong()
        
        val input = hexStringToByteArray(inputHex)
        val actualCRC = BleProtocol.calculateCRC32(input)
        
        assertEquals(expectedCRC, actualCRC, "CRC32 mismatch for 'Hello World'")
        println("✓ Kotlin CRC32 test passed: $actualCRC")
    }

    @Test
    fun `test SHA-256 with known input`() {
        val vectors = testVectors["vectors"]!!.jsonArray
        val shaVector = vectors.first { 
            it.jsonObject["name"]!!.jsonPrimitive.content == "SHA-256 Known Input" 
        }.jsonObject
        
        val inputHex = shaVector["input_hex"]!!.jsonPrimitive.content
        val expectedSHA = shaVector["expected_sha256"]!!.jsonPrimitive.content
        
        val input = hexStringToByteArray(inputHex)
        val actualSHA = BleProtocol.calculateSHA256(input)
        val actualSHAHex = actualSHA.joinToString("") { "%02x".format(it) }
        
        assertEquals(expectedSHA, actualSHAHex, "SHA-256 mismatch for 'Hello World'")
        println("✓ Kotlin SHA-256 test passed: $actualSHAHex")
    }

    @Test
    fun `test chunk header serialization`() {
        val header = BleProtocol.ChunkHeader(
            seq = 0,
            total = 5,
            crc32 = 0x12345678L,
            flags = 0x01
        )
        
        val serialized = BleProtocol.serializeChunkHeader(header)
        
        assertEquals(BleProtocol.CHUNK_HEADER_SIZE, serialized.size, "Header size mismatch")
        
        // Verify big-endian encoding
        assertEquals(0x00, serialized[0].toInt(), "seq high byte")
        assertEquals(0x00, serialized[1].toInt(), "seq low byte")
        assertEquals(0x00, serialized[2].toInt(), "total high byte")
        assertEquals(0x05, serialized[3].toInt(), "total low byte")
        
        println("✓ Kotlin chunk header serialization test passed")
    }

    @Test
    fun `test chunk header deserialization`() {
        val data = byteArrayOf(
            0x00, 0x02, // seq = 2
            0x00, 0x0A, // total = 10
            0x12.toByte(), 0x34.toByte(), 0x56.toByte(), 0x78.toByte(), // crc32
            0x02, // flags (LAST_CHUNK)
            0x00, 0x00, 0x00 // reserved
        )
        
        val header = BleProtocol.deserializeChunkHeader(data)
        
        assertEquals(2, header.seq)
        assertEquals(10, header.total)
        assertEquals(0x12345678L, header.crc32)
        assertEquals(0x02.toByte(), header.flags)
        
        println("✓ Kotlin chunk header deserialization test passed")
    }

    @Test
    fun `test chunk CRC verification`() {
        val payload = "TEST_PAYLOAD_NO_PII".toByteArray()
        val crc = BleProtocol.calculateCRC32(payload)
        
        val header = BleProtocol.ChunkHeader(
            seq = 0,
            total = 1,
            crc32 = crc,
            flags = 0x03 // FIRST_CHUNK | LAST_CHUNK
        )
        
        assertTrue(BleProtocol.verifyChunkCRC(header, payload), "CRC verification should pass")
        
        // Test with wrong CRC
        val wrongHeader = header.copy(crc32 = 0xDEADBEEFL)
        assertFalse(BleProtocol.verifyChunkCRC(wrongHeader, payload), "Wrong CRC should fail")
        
        println("✓ Kotlin chunk CRC verification test passed")
    }

    @Test
    fun `test chunk header roundtrip`() {
        val original = BleProtocol.ChunkHeader(
            seq = 42,
            total = 100,
            crc32 = 0xABCDEF01L,
            flags = 0x01
        )
        
        val serialized = BleProtocol.serializeChunkHeader(original)
        val deserialized = BleProtocol.deserializeChunkHeader(serialized)
        
        assertEquals(original.seq, deserialized.seq)
        assertEquals(original.total, deserialized.total)
        assertEquals(original.crc32, deserialized.crc32)
        assertEquals(original.flags, deserialized.flags)
        
        println("✓ Kotlin chunk header roundtrip test passed")
    }

    @Test
    fun `negative test - CRC mismatch detection`() {
        val payload = "SYNTHETIC_TEST_DATA".toByteArray()
        val wrongCRC = 0x99999999L
        
        val header = BleProtocol.ChunkHeader(
            seq = 0,
            total = 1,
            crc32 = wrongCRC,
            flags = 0x03
        )
        
        assertFalse(
            BleProtocol.verifyChunkCRC(header, payload),
            "CRC mismatch should be detected"
        )
        
        println("✓ Kotlin negative test (CRC mismatch) passed")
    }

    private fun hexStringToByteArray(hex: String): ByteArray {
        val len = hex.length
        val data = ByteArray(len / 2)
        var i = 0
        while (i < len) {
            data[i / 2] = ((Character.digit(hex[i], 16) shl 4) +
                          Character.digit(hex[i + 1], 16)).toByte()
            i += 2
        }
        return data
    }
}

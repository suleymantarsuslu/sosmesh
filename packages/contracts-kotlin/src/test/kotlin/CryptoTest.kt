package com.sosmesh.contracts

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.*
import java.util.Base64

class CryptoTest {
    
    private val testConfig = CryptoConfig(
        keyId = "dev-test-001",
        serverPublicKey = "BFu/Jxfj3txqvjTtUW7BTYK3iX0E/ysPPwPNk091o1c=",
        serverPrivateKey = "/Y3Ly64i9CwSN722vrc39rW2bf4+mRCByoK1fn/z+9U="
    )
    
    private val testEnvelope = mapOf(
        "timestamp" to "2026-10-29T20:00:00Z",
        "location" to mapOf(
            "latitude" to 39.9334,
            "longitude" to 32.8597,
            "accuracy" to 10
        ),
        "priority" to 1
    )
    
    @Test
    fun `should encrypt and decrypt payload successfully`() {
        val plaintext = "Test SOS message: Need help at coordinates".toByteArray()
        
        // Encrypt
        val encrypted = Crypto.encryptPayload(plaintext, testEnvelope, testConfig)
        
        // Verify encrypted structure
        assertNotNull(encrypted.ciphertext)
        assertNotNull(encrypted.nonce)
        assertNotNull(encrypted.ephemeralPublicKey)
        assertEquals("dev-test-001", encrypted.keyId)
        
        // Decrypt
        val decrypted = Crypto.decryptPayload(encrypted, testEnvelope, testConfig)
        
        // Verify roundtrip
        assertArrayEquals(plaintext, decrypted)
    }
    
    @Test
    fun `should fail with tampered ciphertext`() {
        val plaintext = "Test message".toByteArray()
        val encrypted = Crypto.encryptPayload(plaintext, testEnvelope, testConfig)
        
        // First verify untampered decryption succeeds
        val untampered = Crypto.decryptPayload(encrypted, testEnvelope, testConfig)
        assertArrayEquals(plaintext, untampered)
        
        // Tamper with ciphertext
        val ciphertextBytes = Base64.getDecoder().decode(encrypted.ciphertext)
        ciphertextBytes[0] = (ciphertextBytes[0].toInt() xor 0xFF).toByte()
        val tamperedEncrypted = encrypted.copy(
            ciphertext = Base64.getEncoder().encodeToString(ciphertextBytes)
        )
        
        // Should throw
        assertThrows(CryptoException::class.java) {
            Crypto.decryptPayload(tamperedEncrypted, testEnvelope, testConfig)
        }
    }
    
    @Test
    fun `should fail with tampered tag`() {
        val plaintext = "Test message".toByteArray()
        val encrypted = Crypto.encryptPayload(plaintext, testEnvelope, testConfig)
        
        // First verify untampered decryption succeeds
        val untampered = Crypto.decryptPayload(encrypted, testEnvelope, testConfig)
        assertArrayEquals(plaintext, untampered)
        
        // Tamper with tag (last 16 bytes)
        val ciphertextBytes = Base64.getDecoder().decode(encrypted.ciphertext)
        ciphertextBytes[ciphertextBytes.size - 1] = (ciphertextBytes[ciphertextBytes.size - 1].toInt() xor 0x01).toByte()
        val tamperedEncrypted = encrypted.copy(
            ciphertext = Base64.getEncoder().encodeToString(ciphertextBytes)
        )
        
        // Should throw
        assertThrows(CryptoException::class.java) {
            Crypto.decryptPayload(tamperedEncrypted, testEnvelope, testConfig)
        }
    }
    
    @Test
    fun `should fail with tampered AAD`() {
        val plaintext = "Test message".toByteArray()
        val encrypted = Crypto.encryptPayload(plaintext, testEnvelope, testConfig)
        
        // First verify untampered decryption succeeds
        val untampered = Crypto.decryptPayload(encrypted, testEnvelope, testConfig)
        assertArrayEquals(plaintext, untampered)
        
        // Tamper with AAD (envelope metadata)
        val tamperedEnvelope = testEnvelope.toMutableMap()
        tamperedEnvelope["priority"] = 2
        
        // Should throw
        assertThrows(CryptoException::class.java) {
            Crypto.decryptPayload(encrypted, tamperedEnvelope, testConfig)
        }
    }
    
    @Test
    fun `should fail with tampered nonce`() {
        val plaintext = "Test message".toByteArray()
        val encrypted = Crypto.encryptPayload(plaintext, testEnvelope, testConfig)
        
        // First verify untampered decryption succeeds
        val untampered = Crypto.decryptPayload(encrypted, testEnvelope, testConfig)
        assertArrayEquals(plaintext, untampered)
        
        // Tamper with nonce
        val nonceBytes = Base64.getDecoder().decode(encrypted.nonce)
        nonceBytes[0] = (nonceBytes[0].toInt() xor 0xFF).toByte()
        val tamperedEncrypted = encrypted.copy(
            nonce = Base64.getEncoder().encodeToString(nonceBytes)
        )
        
        // Should throw
        assertThrows(CryptoException::class.java) {
            Crypto.decryptPayload(tamperedEncrypted, testEnvelope, testConfig)
        }
    }
    
    @Test
    fun `should fail with wrong key ID`() {
        val plaintext = "Test message".toByteArray()
        val encrypted = Crypto.encryptPayload(plaintext, testEnvelope, testConfig)
        
        // Change key ID
        val tamperedEncrypted = encrypted.copy(keyId = "wrong-key-id")
        
        // Should throw
        val exception = assertThrows(CryptoException::class.java) {
            Crypto.decryptPayload(tamperedEncrypted, testEnvelope, testConfig)
        }
        
        assertTrue(exception.message!!.contains("KEY_ID_MISMATCH"))
    }
    
    @Test
    fun `KeyStorage interface test`() {
        val storage = InMemoryKeyStorage()
        val testKey = ByteArray(32) { it.toByte() }
        
        // Store
        storage.storePrivateKey("test-001", testKey)
        
        // Retrieve
        val retrieved = storage.getPrivateKey("test-001")
        assertNotNull(retrieved)
        assertArrayEquals(testKey, retrieved)
        
        // Delete
        storage.deletePrivateKey("test-001")
        assertNull(storage.getPrivateKey("test-001"))
    }
}

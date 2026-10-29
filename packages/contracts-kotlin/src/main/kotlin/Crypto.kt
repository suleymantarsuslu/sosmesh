package com.sosmesh.contracts

import org.bouncycastle.crypto.agreement.X25519Agreement
import org.bouncycastle.crypto.engines.ChaCha7539Engine
import org.bouncycastle.crypto.modes.ChaCha20Poly1305
import org.bouncycastle.crypto.generators.HKDFBytesGenerator
import org.bouncycastle.crypto.params.AEADParameters
import org.bouncycastle.crypto.params.HKDFParameters
import org.bouncycastle.crypto.params.KeyParameter
import org.bouncycastle.crypto.params.X25519PrivateKeyParameters
import org.bouncycastle.crypto.params.X25519PublicKeyParameters
import org.bouncycastle.crypto.digests.SHA256Digest
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.security.SecureRandom
import java.util.Base64

/**
 * ADIM 09: X25519 + HKDF-SHA256 + ChaCha20-Poly1305 with AAD
 * 
 * Crypto implementation using BouncyCastle for Kotlin/Android.
 * Compatible with TypeScript (@noble libraries) and Swift (swift-crypto) implementations.
 */

@Serializable
data class EncryptedPayload(
    val ciphertext: String, // base64: encrypted data || 16-byte Poly1305 tag
    val nonce: String, // base64: 12-byte random nonce
    val ephemeralPublicKey: String, // base64: 32-byte X25519 public key
    val keyId: String
)

@Serializable
data class CryptoConfig(
    val keyId: String,
    val serverPublicKey: String, // base64
    val serverPrivateKey: String? = null // base64, only for decryption
)

object CryptoConstants {
    const val PROTOCOL_VERSION = "v1"
    const val NONCE_SIZE = 12 // 96 bits for IETF ChaCha20
    const val TAG_SIZE = 16 // 128 bits Poly1305
    const val X25519_KEY_SIZE = 32
}

class CryptoException(message: String) : Exception(message)

object Crypto {
    private val secureRandom = SecureRandom()
    private val json = Json { 
        prettyPrint = false
        encodeDefaults = true
    }

    /**
     * Encrypt payload with server's pinned public key.
     * 
     * @param payload Plaintext bytes to encrypt
     * @param envelope Envelope metadata to bind as AAD
     * @param config Crypto configuration with server public key
     * @return Encrypted payload with ephemeral public key, nonce, and ciphertext+tag
     */
    fun encryptPayload(
        payload: ByteArray,
        envelope: Map<String, Any>,
        config: CryptoConfig
    ): EncryptedPayload {
        // Generate ephemeral X25519 keypair
        val ephemeralPrivateKey = ByteArray(CryptoConstants.X25519_KEY_SIZE)
        secureRandom.nextBytes(ephemeralPrivateKey)
        
        val ephemeralPrivateKeyParams = X25519PrivateKeyParameters(ephemeralPrivateKey, 0)
        val ephemeralPublicKeyParams = ephemeralPrivateKeyParams.generatePublicKey()
        val ephemeralPublicKey = ephemeralPublicKeyParams.encoded
        
        // Parse server public key
        val serverPublicKey = Base64.getDecoder().decode(config.serverPublicKey)
        val serverPublicKeyParams = X25519PublicKeyParameters(serverPublicKey, 0)
        
        // Perform X25519 ECDH
        val agreement = X25519Agreement()
        agreement.init(ephemeralPrivateKeyParams)
        val sharedSecret = ByteArray(CryptoConstants.X25519_KEY_SIZE)
        agreement.calculateAgreement(serverPublicKeyParams, sharedSecret, 0)
        
        // Generate random nonce
        val nonce = ByteArray(CryptoConstants.NONCE_SIZE)
        secureRandom.nextBytes(nonce)
        
        // Derive encryption key using HKDF-SHA256
        val encryptionKey = deriveEncryptionKey(sharedSecret, nonce, config.keyId)
        
        // Create AAD (Associated Authenticated Data)
        val aad = createAAD(envelope, config.keyId)
        
        // Encrypt with ChaCha20-Poly1305
        val cipher = ChaCha20Poly1305()
        val params = AEADParameters(KeyParameter(encryptionKey), CryptoConstants.TAG_SIZE * 8, nonce, aad)
        cipher.init(true, params)
        
        val ciphertextWithTag = ByteArray(cipher.getOutputSize(payload.size))
        var outputLen = cipher.processBytes(payload, 0, payload.size, ciphertextWithTag, 0)
        outputLen += cipher.doFinal(ciphertextWithTag, outputLen)
        
        return EncryptedPayload(
            ciphertext = Base64.getEncoder().encodeToString(ciphertextWithTag),
            nonce = Base64.getEncoder().encodeToString(nonce),
            ephemeralPublicKey = Base64.getEncoder().encodeToString(ephemeralPublicKey),
            keyId = config.keyId
        )
    }

    /**
     * Decrypt payload with server's private key.
     * 
     * @param encrypted Encrypted payload with ephemeral public key, nonce, and ciphertext+tag
     * @param envelope Envelope metadata to verify AAD
     * @param config Crypto configuration with server private key
     * @return Decrypted plaintext bytes
     * @throws CryptoException if decryption fails (wrong key, tampered data, etc.)
     */
    fun decryptPayload(
        encrypted: EncryptedPayload,
        envelope: Map<String, Any>,
        config: CryptoConfig
    ): ByteArray {
        if (encrypted.keyId != config.keyId) {
            throw CryptoException("KEY_ID_MISMATCH: ${encrypted.keyId} != ${config.keyId}")
        }
        
        val serverPrivateKey = config.serverPrivateKey 
            ?: throw CryptoException("MISSING_PRIVATE_KEY: Server private key required for decryption")
        
        // Parse keys
        val serverPrivateKeyBytes = Base64.getDecoder().decode(serverPrivateKey)
        val serverPrivateKeyParams = X25519PrivateKeyParameters(serverPrivateKeyBytes, 0)
        
        val ephemeralPublicKey = Base64.getDecoder().decode(encrypted.ephemeralPublicKey)
        val ephemeralPublicKeyParams = X25519PublicKeyParameters(ephemeralPublicKey, 0)
        
        // Perform X25519 ECDH
        val agreement = X25519Agreement()
        agreement.init(serverPrivateKeyParams)
        val sharedSecret = ByteArray(CryptoConstants.X25519_KEY_SIZE)
        agreement.calculateAgreement(ephemeralPublicKeyParams, sharedSecret, 0)
        
        // Derive encryption key
        val nonce = Base64.getDecoder().decode(encrypted.nonce)
        val encryptionKey = deriveEncryptionKey(sharedSecret, nonce, config.keyId)
        
        // Create AAD
        val aad = createAAD(envelope, config.keyId)
        
        // Decrypt with ChaCha20-Poly1305
        val ciphertextWithTag = Base64.getDecoder().decode(encrypted.ciphertext)
        
        val cipher = ChaCha20Poly1305()
        val params = AEADParameters(KeyParameter(encryptionKey), CryptoConstants.TAG_SIZE * 8, nonce, aad)
        cipher.init(false, params)
        
        try {
            val plaintext = ByteArray(cipher.getOutputSize(ciphertextWithTag.size))
            var outputLen = cipher.processBytes(ciphertextWithTag, 0, ciphertextWithTag.size, plaintext, 0)
            outputLen += cipher.doFinal(plaintext, outputLen)
            
            return plaintext.copyOf(outputLen)
        } catch (e: Exception) {
            throw CryptoException("DECRYPTION_FAILED: ${e.message}")
        }
    }

    /**
     * Derive 32-byte encryption key using HKDF-SHA256.
     * 
     * @param sharedSecret 32-byte X25519 shared secret
     * @param salt 12-byte nonce used as HKDF salt
     * @param keyId Key identifier to include in HKDF info
     * @return 32-byte derived encryption key
     */
    private fun deriveEncryptionKey(sharedSecret: ByteArray, salt: ByteArray, keyId: String): ByteArray {
        val info = "SOSMesh-${CryptoConstants.PROTOCOL_VERSION}-$keyId-encryption".toByteArray()
        
        val hkdf = HKDFBytesGenerator(SHA256Digest())
        hkdf.init(HKDFParameters(sharedSecret, salt, info))
        
        val derivedKey = ByteArray(32)
        hkdf.generateBytes(derivedKey, 0, derivedKey.size)
        
        return derivedKey
    }

    /**
     * Create canonical AAD (Associated Authenticated Data) for authenticated encryption.
     * AAD binds envelope metadata to the ciphertext.
     * 
     * @param envelope Envelope metadata
     * @param keyId Key identifier
     * @return AAD bytes (UTF-8 encoded canonical JSON)
     */
    private fun createAAD(envelope: Map<String, Any>, keyId: String): ByteArray {
        // Manual canonical JSON construction (sorted keys)
        val canonicalJson = buildString {
            append("{")
            append("\"envelope\":")
            append(toCanonicalJson(sortKeys(envelope)))
            append(",\"keyId\":\"$keyId\"")
            append(",\"protocol\":\"${CryptoConstants.PROTOCOL_VERSION}\"")
            append("}")
        }
        
        return canonicalJson.toByteArray(Charsets.UTF_8)
    }

    /**
     * Recursively sort map keys for canonical JSON serialization.
     */
    @Suppress("UNCHECKED_CAST")
    private fun sortKeys(obj: Any): Any {
        return when (obj) {
            is Map<*, *> -> {
                (obj as Map<String, Any>).toSortedMap().mapValues { sortKeys(it.value) }
            }
            is List<*> -> obj.map { sortKeys(it!!) }
            else -> obj
        }
    }
    
    /**
     * Convert object to canonical JSON string.
     */
    @Suppress("UNCHECKED_CAST")
    private fun toCanonicalJson(obj: Any): String {
        return when (obj) {
            is String -> "\"$obj\""
            is Number -> obj.toString()
            is Boolean -> obj.toString()
            is Map<*, *> -> {
                val sorted = (obj as Map<String, Any>).toSortedMap()
                sorted.entries.joinToString(",", "{", "}") { (k, v) ->
                    "\"$k\":${toCanonicalJson(v)}"
                }
            }
            is List<*> -> {
                obj.joinToString(",", "[", "]") { toCanonicalJson(it!!) }
            }
            else -> "null"
        }
    }
}

/**
 * Interface for platform-specific secure key storage.
 * 
 * On Android: Backed by Android Keystore
 * On JVM: Backed by in-memory or file-based storage (for testing)
 */
interface KeyStorage {
    /**
     * Store a private key securely.
     * @param keyId Key identifier
     * @param privateKey 32-byte X25519 private key
     */
    fun storePrivateKey(keyId: String, privateKey: ByteArray)
    
    /**
     * Retrieve a private key.
     * @param keyId Key identifier
     * @return 32-byte X25519 private key, or null if not found
     */
    fun getPrivateKey(keyId: String): ByteArray?
    
    /**
     * Delete a private key.
     * @param keyId Key identifier
     */
    fun deletePrivateKey(keyId: String)
}

/**
 * JVM in-memory key storage for testing.
 * NOT SECURE FOR PRODUCTION USE.
 */
class InMemoryKeyStorage : KeyStorage {
    private val storage = mutableMapOf<String, ByteArray>()
    
    override fun storePrivateKey(keyId: String, privateKey: ByteArray) {
        storage[keyId] = privateKey.copyOf()
    }
    
    override fun getPrivateKey(keyId: String): ByteArray? {
        return storage[keyId]?.copyOf()
    }
    
    override fun deletePrivateKey(keyId: String) {
        storage.remove(keyId)
    }
}

/**
 * Android Keystore adapter.
 * MARKED AS NOT_TESTED: Requires real Android device/emulator.
 * Implementation placeholder - actual Android Keystore integration requires:
 * - KeyStore.getInstance("AndroidKeyStore")
 * - KeyGenerator with KeyGenParameterSpec
 * - Proper key access controls and biometric authentication
 */
class AndroidKeystoreAdapter : KeyStorage {
    init {
        println("WARNING: AndroidKeystoreAdapter is NOT_TESTED and requires real device")
    }
    
    override fun storePrivateKey(keyId: String, privateKey: ByteArray) {
        TODO("NOT_TESTED: Requires Android Keystore on real device")
    }
    
    override fun getPrivateKey(keyId: String): ByteArray? {
        TODO("NOT_TESTED: Requires Android Keystore on real device")
    }
    
    override fun deletePrivateKey(keyId: String) {
        TODO("NOT_TESTED: Requires Android Keystore on real device")
    }
}

package com.sosmesh.android.core.protocol

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.security.MessageDigest

/**
 * BLE transfer payload for one opaque, sender-encrypted attachment copy (mesh-v2 §2.5).
 *
 * `SOSATT1\n` + one-line JSON header (sosId, attachmentId, kind, nonce, ephemeralPublicKey, keyId) + `\n` + raw ciphertext.
 * Relays never decrypt: the ciphertext is stored and later uploaded verbatim.
 */
object BleAttachmentWire {
    private val MAGIC = "SOSATT1\n".toByteArray(Charsets.US_ASCII)
    private val json = Json { ignoreUnknownKeys = true }

    /** Largest ciphertext a relay accepts (sender caps media at 160 KB image / 128 KB audio before the ~4/3 JSON-base64 inner). */
    const val MAX_CIPHERTEXT_BYTES: Int = 300 * 1024
    const val MAX_ATTACHMENTS_PER_SOS: Int = 4

    data class Parsed(
        val sosId: String,
        val attachmentId: String,
        val kind: String,
        val nonce: String,
        val ephemeralPublicKey: String,
        val keyId: String,
        val ciphertext: ByteArray,
    )

    fun isAttachment(payload: ByteArray): Boolean =
        payload.size > MAGIC.size && MAGIC.indices.all { payload[it] == MAGIC[it] }

    fun encode(
        sosId: String,
        attachmentId: String,
        kind: String,
        nonce: String,
        ephemeralPublicKey: String,
        keyId: String,
        ciphertext: ByteArray,
    ): ByteArray {
        val header =
            JsonObject(
                mapOf(
                    "sosId" to JsonPrimitive(sosId),
                    "attachmentId" to JsonPrimitive(attachmentId),
                    "kind" to JsonPrimitive(kind),
                    "nonce" to JsonPrimitive(nonce),
                    "ephemeralPublicKey" to JsonPrimitive(ephemeralPublicKey),
                    "keyId" to JsonPrimitive(keyId),
                ),
            ).toString().toByteArray(Charsets.UTF_8)
        return MAGIC + header + byteArrayOf('\n'.code.toByte()) + ciphertext
    }

    fun decode(payload: ByteArray): Parsed? {
        if (!isAttachment(payload)) return null
        val newline = (MAGIC.size until payload.size).firstOrNull { payload[it] == '\n'.code.toByte() } ?: return null
        return try {
            val header = json.parseToJsonElement(String(payload, MAGIC.size, newline - MAGIC.size, Charsets.UTF_8)).jsonObject
            fun field(name: String) = header[name]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() }
            val kind = field("kind") ?: return null
            if (kind != "image" && kind != "audio") return null
            val ciphertext = payload.copyOfRange(newline + 1, payload.size)
            if (ciphertext.isEmpty() || ciphertext.size > MAX_CIPHERTEXT_BYTES) return null
            Parsed(
                sosId = field("sosId") ?: return null,
                attachmentId = field("attachmentId")?.takeIf { SAFE_ID.matches(it) } ?: return null,
                kind = kind,
                nonce = field("nonce") ?: return null,
                ephemeralPublicKey = field("ephemeralPublicKey") ?: return null,
                keyId = field("keyId") ?: return null,
                ciphertext = ciphertext,
            )
        } catch (_: Exception) {
            null
        }
    }

    /** Engine digest convention: base64 SHA-256 of the transfer payload. */
    fun digestOf(payload: ByteArray): String = java.util.Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-256").digest(payload))

    private val SAFE_ID = Regex("^[A-Za-z0-9_-]{1,64}$")
}

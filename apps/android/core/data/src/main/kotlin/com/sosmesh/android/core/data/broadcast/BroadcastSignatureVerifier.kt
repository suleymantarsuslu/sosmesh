package com.sosmesh.android.core.data.broadcast

import android.util.Base64
import com.google.crypto.tink.subtle.Ed25519Verify

class BroadcastSignatureVerifier(publicKeyBase64: String) {
    // Raw 32-byte Ed25519 key from the 44-byte SPKI. Tink is used because the platform
    // "Ed25519" KeyFactory only exists on Android 13+; a bad key fails closed in verify().
    private val rawPublicKey: ByteArray? =
        runCatching { Base64.decode(publicKeyBase64, Base64.NO_WRAP) }
            .getOrNull()
            ?.takeIf { it.size == SPKI_LENGTH }
            ?.copyOfRange(SPKI_LENGTH - RAW_KEY_LENGTH, SPKI_LENGTH)

    fun verify(broadcast: ServerBroadcast): Boolean {
        return try {
            val regionPart = if (broadcast.regionLat != null && broadcast.regionLng != null && broadcast.regionRadiusKm != null) {
                "|${jsNumber(broadcast.regionLat)}|${jsNumber(broadcast.regionLng)}|${jsNumber(broadcast.regionRadiusKm)}"
            } else {
                ""
            }
            val payload =
                "BROADCAST|${broadcast.id}|${broadcast.title}|${broadcast.body}|${broadcast.severity}|${broadcast.createdAt}|${broadcast.expiresAt}$regionPart"
            val signatureBytes = Base64.decode(broadcast.signature, Base64.NO_WRAP)
            val key = rawPublicKey ?: return false
            Ed25519Verify(key).verify(signatureBytes, payload.toByteArray(Charsets.UTF_8))
            true
        } catch (e: Exception) {
            false
        }
    }

    // The server signs with JavaScript number formatting, where 50.0 is written as "50".
    private fun jsNumber(value: Double): String =
        if (value % 1.0 == 0.0 && kotlin.math.abs(value) < 1e15) value.toLong().toString() else value.toString()

    private companion object {
        const val SPKI_LENGTH = 44
        const val RAW_KEY_LENGTH = 32
    }
}

data class ServerBroadcast(
    val id: String,
    val title: String,
    val body: String,
    val severity: String,
    val createdAt: String,
    val expiresAt: String,
    val regionLat: Double?,
    val regionLng: Double?,
    val regionRadiusKm: Double?,
    val signature: String,
)

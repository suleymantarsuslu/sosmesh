package com.sosmesh.android.core.data.broadcast

import android.util.Base64
import java.security.KeyFactory
import java.security.PublicKey
import java.security.Signature
import java.security.spec.X509EncodedKeySpec

class BroadcastSignatureVerifier(publicKeyBase64: String) {
    private val publicKey: PublicKey

    init {
        val keyBytes = Base64.decode(publicKeyBase64, Base64.NO_WRAP)
        val keySpec = X509EncodedKeySpec(keyBytes)
        val keyFactory = KeyFactory.getInstance("Ed25519")
        publicKey = keyFactory.generatePublic(keySpec)
    }

    fun verify(broadcast: ServerBroadcast): Boolean {
        return try {
            val regionPart = if (broadcast.regionLat != null && broadcast.regionLng != null && broadcast.regionRadiusKm != null) {
                "|${broadcast.regionLat}|${broadcast.regionLng}|${broadcast.regionRadiusKm}"
            } else {
                ""
            }
            val payload =
                "BROADCAST|${broadcast.id}|${broadcast.title}|${broadcast.body}|${broadcast.severity}|${broadcast.createdAt}|${broadcast.expiresAt}$regionPart"
            val signatureBytes = Base64.decode(broadcast.signature, Base64.NO_WRAP)
            val sig = Signature.getInstance("Ed25519")
            sig.initVerify(publicKey)
            sig.update(payload.toByteArray(Charsets.UTF_8))
            sig.verify(signatureBytes)
        } catch (e: Exception) {
            false
        }
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

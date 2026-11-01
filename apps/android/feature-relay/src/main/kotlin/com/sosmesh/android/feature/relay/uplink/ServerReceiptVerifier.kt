package com.sosmesh.android.feature.relay.uplink

import java.security.KeyFactory
import java.security.PublicKey
import java.security.Signature
import java.security.spec.X509EncodedKeySpec
import javax.inject.Inject
import javax.inject.Singleton
import android.util.Base64 as AndroidBase64

@Singleton
class ServerReceiptVerifier
    @Inject
    constructor(
        private val config: RelayIngestConfig,
    ) {
        fun verify(
            receipt: ServerAcceptedReceipt,
            expectedMessageId: String,
            expectedPacketHash: String,
        ): Boolean {
            if (receipt.ackType != "SERVER_ACCEPTED") {
                return false
            }
            if (receipt.messageId != expectedMessageId || receipt.packetHash != expectedPacketHash) {
                return false
            }
            val publicKey = loadPublicKey() ?: return false
            val payload =
                "SERVER_ACCEPTED|${receipt.messageId}|${receipt.packetHash}|${receipt.timestamp}"
            val signatureBytes = AndroidBase64.decode(receipt.signature, AndroidBase64.DEFAULT)
            val verifier = Signature.getInstance("Ed25519")
            verifier.initVerify(publicKey)
            verifier.update(payload.toByteArray(Charsets.UTF_8))
            return try {
                verifier.verify(signatureBytes)
            } catch (_: Exception) {
                false
            }
        }

        private fun loadPublicKey(): PublicKey? {
            val encoded = config.receiptVerifyPublicKeySpkiBase64
            if (encoded.isBlank()) {
                return null
            }
            val der = AndroidBase64.decode(encoded, AndroidBase64.DEFAULT)
            val spec = X509EncodedKeySpec(der)
            return KeyFactory.getInstance("Ed25519").generatePublic(spec)
        }
    }

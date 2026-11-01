package com.sosmesh.android.feature.relay.uplink

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.security.KeyPairGenerator
import java.security.Signature
import java.util.Base64

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class ServerReceiptVerifierTest {
    private lateinit var privateKeyDer: ByteArray
    private lateinit var publicSpkiBase64: String
    private lateinit var verifier: ServerReceiptVerifier

    @Before
    fun setUp() {
        val keyPair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
        privateKeyDer = keyPair.private.encoded
        publicSpkiBase64 = Base64.getEncoder().encodeToString(keyPair.public.encoded)
        verifier =
            ServerReceiptVerifier(
                RelayIngestConfig(
                    ingestUrl = "http://127.0.0.1:9/ingest",
                    receiptVerifyPublicKeySpkiBase64 = publicSpkiBase64,
                    relayIdHex = "a".repeat(64),
                    requireHttps = false,
                ),
            )
    }

    @Test
    fun validSignature_accepted() {
        val receipt = signedReceipt("msg-1", "aa".repeat(32))
        assertTrue(verifier.verify(receipt, "msg-1", "aa".repeat(32)))
    }

    @Test
    fun wrongPacketHash_rejected() {
        val receipt = signedReceipt("msg-1", "aa".repeat(32))
        assertFalse(verifier.verify(receipt, "msg-1", "bb".repeat(32)))
    }

    @Test
    fun tamperedSignature_rejected() {
        val receipt = signedReceipt("msg-1", "aa".repeat(32)).copy(signature = "AAAA")
        assertFalse(verifier.verify(receipt, "msg-1", "aa".repeat(32)))
    }

    private fun signedReceipt(
        messageId: String,
        packetHash: String,
    ): ServerAcceptedReceipt {
        val timestamp = "2026-10-31T12:00:00.000Z"
        val payload = "SERVER_ACCEPTED|$messageId|$packetHash|$timestamp"
        val signer = Signature.getInstance("Ed25519")
        val privateKey =
            java.security.KeyFactory.getInstance("Ed25519").generatePrivate(
                java.security.spec.PKCS8EncodedKeySpec(privateKeyDer),
            )
        signer.initSign(privateKey)
        signer.update(payload.toByteArray(Charsets.UTF_8))
        val signature = Base64.getEncoder().encodeToString(signer.sign())
        return ServerAcceptedReceipt(
            ackType = "SERVER_ACCEPTED",
            messageId = messageId,
            packetHash = packetHash,
            timestamp = timestamp,
            signature = signature,
        )
    }
}

package com.sosmesh.android.core.data.broadcast

import android.util.Base64
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.security.KeyPairGenerator
import java.security.Signature

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [30])
class BroadcastSignatureVerifierTest {
    @Test
    fun verifyValidSignature_withoutRegion() {
        val keyPair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
        val publicKeyBase64 = Base64.encodeToString(keyPair.public.encoded, Base64.NO_WRAP)

        val broadcast =
            ServerBroadcast(
                id = "test-id",
                title = "Test",
                body = "Test body",
                severity = "info",
                createdAt = "2026-11-04T12:00:00Z",
                expiresAt = "2026-11-05T12:00:00Z",
                regionLat = null,
                regionLng = null,
                regionRadiusKm = null,
                signature = "",
            )

        val payload =
            "BROADCAST|${broadcast.id}|${broadcast.title}|${broadcast.body}|${broadcast.severity}|${broadcast.createdAt}|${broadcast.expiresAt}"
        val sig = Signature.getInstance("Ed25519")
        sig.initSign(keyPair.private)
        sig.update(payload.toByteArray(Charsets.UTF_8))
        val signatureBytes = sig.sign()
        val signatureBase64 = Base64.encodeToString(signatureBytes, Base64.NO_WRAP)

        val broadcastWithSig = broadcast.copy(signature = signatureBase64)
        val verifier = BroadcastSignatureVerifier(publicKeyBase64)

        assertTrue(verifier.verify(broadcastWithSig))
    }

    @Test
    fun verifyValidSignature_withRegion() {
        val keyPair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
        val publicKeyBase64 = Base64.encodeToString(keyPair.public.encoded, Base64.NO_WRAP)

        val broadcast =
            ServerBroadcast(
                id = "test-id",
                title = "Test",
                body = "Test body",
                severity = "warning",
                createdAt = "2026-11-04T12:00:00Z",
                expiresAt = "2026-11-05T12:00:00Z",
                regionLat = 40.7128,
                regionLng = -74.0060,
                regionRadiusKm = 50.0,
                signature = "",
            )

        val payload =
            "BROADCAST|${broadcast.id}|${broadcast.title}|${broadcast.body}|${broadcast.severity}|${broadcast.createdAt}|${broadcast.expiresAt}|${broadcast.regionLat}|${broadcast.regionLng}|${broadcast.regionRadiusKm}"
        val sig = Signature.getInstance("Ed25519")
        sig.initSign(keyPair.private)
        sig.update(payload.toByteArray(Charsets.UTF_8))
        val signatureBytes = sig.sign()
        val signatureBase64 = Base64.encodeToString(signatureBytes, Base64.NO_WRAP)

        val broadcastWithSig = broadcast.copy(signature = signatureBase64)
        val verifier = BroadcastSignatureVerifier(publicKeyBase64)

        assertTrue(verifier.verify(broadcastWithSig))
    }

    @Test
    fun rejectTamperedBroadcast() {
        val keyPair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
        val publicKeyBase64 = Base64.encodeToString(keyPair.public.encoded, Base64.NO_WRAP)

        val broadcast =
            ServerBroadcast(
                id = "test-id",
                title = "Original",
                body = "Test body",
                severity = "info",
                createdAt = "2026-11-04T12:00:00Z",
                expiresAt = "2026-11-05T12:00:00Z",
                regionLat = null,
                regionLng = null,
                regionRadiusKm = null,
                signature = "",
            )

        val payload =
            "BROADCAST|${broadcast.id}|${broadcast.title}|${broadcast.body}|${broadcast.severity}|${broadcast.createdAt}|${broadcast.expiresAt}"
        val sig = Signature.getInstance("Ed25519")
        sig.initSign(keyPair.private)
        sig.update(payload.toByteArray(Charsets.UTF_8))
        val signatureBytes = sig.sign()
        val signatureBase64 = Base64.encodeToString(signatureBytes, Base64.NO_WRAP)

        val tamperedBroadcast = broadcast.copy(title = "Tampered", signature = signatureBase64)
        val verifier = BroadcastSignatureVerifier(publicKeyBase64)

        assertFalse(verifier.verify(tamperedBroadcast))
    }
}

package com.sosmesh.android.core.protocol

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BleAttachmentWireTest {
    private val ciphertext = ByteArray(2048) { (it * 31).toByte() }

    private fun sample() = BleAttachmentWire.encode("sos-1", "abc123", "image", "bm9uY2U=", "ZXBo", "key-1", ciphertext)

    @Test
    fun roundTripKeepsBinaryCiphertextVerbatim() {
        val parsed = BleAttachmentWire.decode(sample())!!
        assertEquals("sos-1", parsed.sosId)
        assertEquals("abc123", parsed.attachmentId)
        assertEquals("image", parsed.kind)
        assertEquals("key-1", parsed.keyId)
        assertArrayEquals(ciphertext, parsed.ciphertext)
    }

    @Test
    fun ciphertextContainingNewlinesIsNotTruncated() {
        val withNewlines = byteArrayOf(10, 10, 1, 2, 10)
        val payload = BleAttachmentWire.encode("s", "a1", "audio", "n", "e", "k", withNewlines)
        assertArrayEquals(withNewlines, BleAttachmentWire.decode(payload)!!.ciphertext)
    }

    @Test
    fun otherTransferPayloadsAreNotAttachments() {
        assertFalse(BleAttachmentWire.isAttachment("""{"protocolVersion":2,"messageId":"x"}""".toByteArray()))
        assertFalse(BleAttachmentWire.isAttachment("""{"kind":"TOMBSTONES"}""".toByteArray()))
        assertTrue(BleAttachmentWire.isAttachment(sample()))
    }

    @Test
    fun rejectsUnknownKindUnsafeIdAndOversize() {
        assertNull(BleAttachmentWire.decode(BleAttachmentWire.encode("s", "a1", "video", "n", "e", "k", ciphertext)))
        assertNull(BleAttachmentWire.decode(BleAttachmentWire.encode("s", "../x", "image", "n", "e", "k", ciphertext)))
        val huge = ByteArray(BleAttachmentWire.MAX_CIPHERTEXT_BYTES + 1)
        assertNull(BleAttachmentWire.decode(BleAttachmentWire.encode("s", "a1", "image", "n", "e", "k", huge)))
    }

    @Test
    fun digestIsStableBase64Sha256() {
        assertEquals(BleAttachmentWire.digestOf(sample()), BleAttachmentWire.digestOf(sample().copyOf()))
    }
}

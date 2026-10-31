package com.sosmesh.android.feature.relay

import com.sosmesh.contracts.transport.EnqueueInput
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class RelayNoDecryptTest {
    @Test
    fun relaySources_doNotCallDecryptApi() {
        val dir = File("src/main/kotlin/com/sosmesh/android/feature/relay")
        val joined = dir.walkTopDown().filter { it.extension == "kt" }.joinToString("\n") { it.readText() }
        assertFalse(joined.contains("decryptPayload"))
        assertFalse(joined.contains("Crypto.decrypt"))
    }
}

class RelayDedupTest {
    @Test
    fun duplicateMessageId_singleOutboxRow() {
        val adapter = InMemoryOutbox()
        val registrar = RelayEnvelopeRegistrar(adapter)
        val payload =
            """
            {"version":1,"id":"dup-15","envelope":{"timestamp":"2026-10-29T17:00:00Z","priority":1},"encryptedPayload":"cipher"}
            """.trimIndent().toByteArray()
        val first = registrar.registerFromWirePayload(payload, 100L)
        assertTrue("register failed: ${first.exceptionOrNull()}", first.isSuccess)
        val second = registrar.registerFromWirePayload(payload, 200L)
        assertTrue(second.isSuccess)
        assertEquals(1, adapter.listAll().size)
    }

    private class InMemoryOutbox : com.sosmesh.contracts.transport.OutboxQueueAdapter {
        private val rows = linkedMapOf<Pair<String, String>, com.sosmesh.contracts.transport.OutboxEntryMeta>()

        override fun enqueue(
            input: EnqueueInput,
            nowMs: Long,
        ): com.sosmesh.contracts.transport.OutboxEntryMeta {
            val key = input.sosId to input.digest
            rows[key]?.let { return it }
            val meta =
                com.sosmesh.contracts.transport.OutboxEntryMeta(
                    sosId = input.sosId,
                    digest = input.digest,
                    origin = input.origin,
                    encryptedBlobBase64 = input.encryptedBlobBase64,
                    state = "LOCAL_SAVED",
                    retryAtMs = nowMs,
                    expiresAtMs = nowMs + 86_400_000L,
                    lastError = null,
                    createdAtMs = nowMs,
                    updatedAtMs = nowMs,
                )
            rows[key] = meta
            return meta
        }

        override fun getByKey(
            sosId: String,
            digest: String,
        ): com.sosmesh.contracts.transport.OutboxEntryMeta? = rows[sosId to digest]

        override fun listAll(): List<com.sosmesh.contracts.transport.OutboxEntryMeta> = rows.values.toList()

        override fun updateState(
            sosId: String,
            digest: String,
            state: String,
            nowMs: Long,
            lastError: String?,
        ): com.sosmesh.contracts.transport.OutboxEntryMeta? = null

        override fun setRetryAt(
            sosId: String,
            digest: String,
            retryAtMs: Long,
            lastError: String?,
        ) = Unit

        override fun countDueForSend(
            nowMs: Long,
            paused: Boolean,
        ): Int = 0

        override fun purgeExpired(nowMs: Long): Int = 0

        override fun close() = Unit
    }
}

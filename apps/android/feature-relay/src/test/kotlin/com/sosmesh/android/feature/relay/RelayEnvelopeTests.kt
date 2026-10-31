package com.sosmesh.android.feature.relay

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.sosmesh.android.core.data.fixtures.AndroidStateTransitionLoader
import com.sosmesh.android.core.data.outbox.OutboxDatabase
import com.sosmesh.android.core.data.outbox.RoomOutboxQueueAdapter
import com.sosmesh.android.feature.relay.upload.RelayUploadCommands
import com.sosmesh.ble.BleProtocol
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File
import java.util.Base64

class NoopUploadCommands : RelayUploadCommands {
    override fun scheduleUpload(
        nowMs: Long,
        delayMs: Long,
    ) = Unit

    override fun cancelUpload() = Unit
}

class RelayNoDecryptTest {
    @Test
    fun relaySources_doNotCallDecryptApi() {
        val dir = File("src/main/kotlin/com/sosmesh/android/feature/relay")
        val joined = dir.walkTopDown().filter { it.extension == "kt" }.joinToString("\n") { it.readText() }
        assertFalse(joined.contains("decryptPayload"))
        assertFalse(joined.contains("Crypto.decrypt"))
    }
}

class RelayDedupKeyTest {
    @Test
    fun registrar_producesStableSosIdAndDigestKey() {
        ThrowingOutbox.enqueueCalls = 0
        ThrowingOutbox.lastSosId = null
        ThrowingOutbox.lastDigest = null
        val registrar = RelayEnvelopeRegistrar(ThrowingOutbox(), NoopUploadCommands())
        val payload =
            """
            {"version":1,"id":"dup-15","envelope":{"timestamp":"2026-10-29T17:00:00Z","priority":1},"encryptedPayload":"cipher"}
            """.trimIndent().toByteArray()
        val first = registrar.registerFromWirePayload(payload, 100L)
        val second = registrar.registerFromWirePayload(payload, 200L)
        assertTrue(first.isSuccess)
        assertTrue(second.isSuccess)
        val expectedDigest = Base64.getEncoder().encodeToString(BleProtocol.calculateSHA256(payload))
        assertEquals("dup-15", ThrowingOutbox.lastSosId)
        assertEquals(expectedDigest, ThrowingOutbox.lastDigest)
        assertEquals(2, ThrowingOutbox.enqueueCalls)
    }

    private class ThrowingOutbox : com.sosmesh.contracts.transport.OutboxQueueAdapter {
        companion object {
            var lastSosId: String? = null
            var lastDigest: String? = null
            var enqueueCalls = 0
        }

        override fun enqueue(
            input: com.sosmesh.contracts.transport.EnqueueInput,
            nowMs: Long,
        ): com.sosmesh.contracts.transport.OutboxEntryMeta {
            enqueueCalls++
            lastSosId = input.sosId
            lastDigest = input.digest
            return com.sosmesh.contracts.transport.OutboxEntryMeta(
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
        }

        override fun getByKey(
            sosId: String,
            digest: String,
        ): com.sosmesh.contracts.transport.OutboxEntryMeta? = null

        override fun listAll(): List<com.sosmesh.contracts.transport.OutboxEntryMeta> = emptyList()

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

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class RelayRoomOutboxDedupTest {
    @Test
    fun duplicateRegister_singleRowInRoomOutbox() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val db =
            Room.inMemoryDatabaseBuilder(context, OutboxDatabase::class.java)
                .allowMainThreadQueries()
                .build()
        val fixture =
            AndroidStateTransitionLoader.load(
                javaClass.classLoader!!.getResourceAsStream("state-transitions.json")!!,
            )
        val adapter = RoomOutboxQueueAdapter(db.outboxDao(), fixture.defaultRetentionMs)
        val registrar = RelayEnvelopeRegistrar(adapter, NoopUploadCommands())
        val payload =
            """
            {"version":1,"id":"room-dup-15","envelope":{"timestamp":"2026-10-29T17:00:00Z","priority":1},"encryptedPayload":"cipher"}
            """.trimIndent().toByteArray()
        registrar.registerFromWirePayload(payload, 100L)
        registrar.registerFromWirePayload(payload, 200L)
        assertEquals(1, adapter.listAll().size)
        db.close()
    }
}

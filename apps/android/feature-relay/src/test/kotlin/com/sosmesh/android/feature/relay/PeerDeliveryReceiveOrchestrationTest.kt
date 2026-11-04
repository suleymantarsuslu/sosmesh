package com.sosmesh.android.feature.relay

import androidx.test.core.app.ApplicationProvider
import com.sosmesh.android.core.data.di.OutboxIoScope
import com.sosmesh.android.core.protocol.ErrorCode
import com.sosmesh.android.feature.relay.uplink.RelayIdentityProvider
import com.sosmesh.android.feature.relay.upload.RelayUploadCommands
import com.sosmesh.android.meshv2.MeshForwardQueue
import com.sosmesh.android.meshv2.MeshRouteSelector
import com.sosmesh.android.meshv2.MeshV2RelayCoordinator
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Receive path: wire payload stored without decrypt API; mesh v2 opaque forward queue.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class PeerDeliveryReceiveOrchestrationTest {
    private lateinit var outbox: RecordingOutbox
    private lateinit var registrar: RelayEnvelopeRegistrar
    private lateinit var handler: RelayTransferHandler

    @Before
    fun setUp() {
        outbox = RecordingOutbox()
        registrar = RelayEnvelopeRegistrar(outbox, NoOpRelayUploadCommands)
        handler =
            relayHandler(
                registrar = registrar,
                meshV2RelayCoordinator =
                    MeshV2RelayCoordinator(
                        forwardQueue = MeshForwardQueue(maxDepth = 8),
                        routeSelector = MeshRouteSelector(),
                    ),
            )
    }

    @Test
    fun onCompleted_storesRelayOutboxWithoutDecrypt() =
        runBlocking {
            // Fixture timestamp is fixed; mesh-v2 time TTL (originCreatedAt + 24 h) needs a fresh one.
            handler.onCompleted(freshBareL2())
            assertEquals(1, outbox.enqueued.size)
            assertEquals("relay", outbox.enqueued.single().origin)
        }

    @Test
    fun onCompleted_l1Envelope_storesInnerL2ForRelay() =
        runBlocking {
            val l2 = freshBareL2()
            val l1 =
                """{"protocolVersion":2,"messageId":"m-l1","hopCount":1,"maxHops":8,"ttlHops":7,""" +
                    """"copyCount":1,"maxCopyCount":16,"originCreatedAt":"${java.time.Instant.now()}",""" +
                    """"opaqueCiphertextBase64":"${java.util.Base64.getEncoder().encodeToString(l2)}",""" +
                    """"hopChainReceipt":{"relayDeviceIdHashes":[]}}"""
            handler.onCompleted(l1.toByteArray())
            assertEquals(1, outbox.enqueued.size)
            val stored = java.util.Base64.getDecoder().decode(outbox.enqueued.single().encryptedBlobBase64)
            assertEquals(l2.decodeToString(), stored.decodeToString())
        }

    @Test
    fun onCompleted_bareL2OlderThan24h_isDroppedPerTimeTtl() =
        runBlocking {
            val stale = java.time.Instant.now().minusSeconds(25 * 3600).toString()
            handler.onCompleted(fixture().replace(FIXTURE_TS, stale).toByteArray())
            assertEquals(0, outbox.enqueued.size)
        }

    private fun fixture(): String =
        javaClass.classLoader!!.getResourceAsStream("valid-sos.json")!!.readBytes().decodeToString()

    private fun freshBareL2(): ByteArray = fixture().replace(FIXTURE_TS, java.time.Instant.now().toString()).toByteArray()

    @Test
    fun onFailed_doesNotEnqueue() {
        handler.onFailed(ErrorCode.CRC_MISMATCH, "crc")
        assertEquals(0, outbox.enqueued.size)
    }

    private class RecordingOutbox : com.sosmesh.contracts.transport.OutboxQueueAdapter {
        val enqueued = mutableListOf<com.sosmesh.contracts.transport.EnqueueInput>()

        override suspend fun enqueue(
            input: com.sosmesh.contracts.transport.EnqueueInput,
            nowMs: Long,
        ): com.sosmesh.contracts.transport.OutboxEntryMeta {
            enqueued.add(input)
            return com.sosmesh.contracts.transport.OutboxEntryMeta(
                sosId = input.sosId,
                digest = input.digest,
                origin = input.origin,
                encryptedBlobBase64 = input.encryptedBlobBase64,
                state = "LOCAL_SAVED",
                retryAtMs = nowMs,
                expiresAtMs = nowMs + 1000L,
                lastError = null,
                createdAtMs = nowMs,
                updatedAtMs = nowMs,
            )
        }

        override suspend fun getByKey(
            sosId: String,
            digest: String,
        ): com.sosmesh.contracts.transport.OutboxEntryMeta? = null

        override suspend fun listAll(): List<com.sosmesh.contracts.transport.OutboxEntryMeta> = emptyList()

        override suspend fun updateState(
            sosId: String,
            digest: String,
            state: String,
            nowMs: Long,
            lastError: String?,
        ): com.sosmesh.contracts.transport.OutboxEntryMeta? = null

        override suspend fun setRetryAt(
            sosId: String,
            digest: String,
            retryAtMs: Long,
            lastError: String?,
        ) = Unit

        override suspend fun countDueForSend(
            nowMs: Long,
            paused: Boolean,
        ): Int = 0

        override suspend fun purgeExpired(nowMs: Long): Int = 0

        override suspend fun setUploadRetryAt(
            sosId: String,
            digest: String,
            retryAtMs: Long,
            lastError: String?,
        ) = Unit

        override suspend fun clearUploadRetry(
            sosId: String,
            digest: String,
        ) = Unit

        override fun close() = Unit
    }
}

private object NoOpRelayUploadCommands : RelayUploadCommands {
    override fun scheduleUpload(
        nowMs: Long,
        delayMs: Long,
    ) = Unit

    override fun cancelUpload() = Unit
}

private const val FIXTURE_TS = "2026-10-29T16:00:00Z"

private fun relayHandler(
    registrar: RelayEnvelopeRegistrar,
    meshV2RelayCoordinator: MeshV2RelayCoordinator,
): RelayTransferHandler {
    val context = ApplicationProvider.getApplicationContext<android.content.Context>()
    return RelayTransferHandler(
        registrar = registrar,
        meshV2 =
            com.sosmesh.android.meshv2.v2.MeshV2Runtime(
                com.sosmesh.android.meshv2.v2.MeshV2Config(RelayIdentityProvider(context).relayIdHex, ""),
            ),
        outboxIoScope = OutboxIoScope(Dispatchers.Unconfined),
    )
}

package com.sosmesh.android.feature.relay

import com.sosmesh.android.core.protocol.ErrorCode
import androidx.test.core.app.ApplicationProvider
import com.sosmesh.android.feature.relay.uplink.RelayIdentityProvider
import com.sosmesh.android.feature.relay.upload.RelayUploadCommands
import com.sosmesh.android.meshv2.MeshForwardQueue
import com.sosmesh.android.meshv2.MeshRouteSelector
import com.sosmesh.android.meshv2.MeshV2RelayCoordinator
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
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
    fun onCompleted_storesRelayOutboxWithoutDecrypt() {
        val wire = javaClass.classLoader!!.getResourceAsStream("valid-sos.json")!!.readBytes()
        handler.onCompleted(wire)
        assertEquals(1, outbox.enqueued.size)
        assertEquals("relay", outbox.enqueued.single().origin)
    }

    @Test
    fun onFailed_doesNotEnqueue() {
        handler.onFailed(ErrorCode.CRC_MISMATCH, "crc")
        assertEquals(0, outbox.enqueued.size)
    }

    private class RecordingOutbox : com.sosmesh.contracts.transport.OutboxQueueAdapter {
        val enqueued = mutableListOf<com.sosmesh.contracts.transport.EnqueueInput>()

        override fun enqueue(
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

private object NoOpRelayUploadCommands : RelayUploadCommands {
    override fun scheduleUpload(
        nowMs: Long,
        delayMs: Long,
    ) = Unit

    override fun cancelUpload() = Unit
}

private fun relayHandler(
    registrar: RelayEnvelopeRegistrar,
    meshV2RelayCoordinator: MeshV2RelayCoordinator,
): RelayTransferHandler {
    val context = ApplicationProvider.getApplicationContext<android.content.Context>()
    return RelayTransferHandler(
        registrar = registrar,
        meshV2RelayCoordinator = meshV2RelayCoordinator,
        relayIdentityProvider = RelayIdentityProvider(context),
    )
}

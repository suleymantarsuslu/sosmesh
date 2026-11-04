package com.sosmesh.android.wear.ui

import com.sosmesh.android.core.ble.BleMeshRadio
import com.sosmesh.android.core.ble.BleRadioStatus
import com.sosmesh.android.core.ble.GattUiConnectionState
import com.sosmesh.android.core.data.sos.SosComposeRequest
import com.sosmesh.android.core.data.sos.SosMessageComposer
import com.sosmesh.android.core.wear.companion.queue.InMemoryWearOfflineQueueStore
import com.sosmesh.android.core.wear.companion.sync.WearUserFacingPhase
import com.sosmesh.android.core.wear.companion.transport.WearCompanionTransport
import com.sosmesh.android.core.wear.companion.watch.WearSosCoordinator
import com.sosmesh.android.meshv2.v2.CarryStore
import com.sosmesh.android.meshv2.v2.MeshV2Config
import com.sosmesh.android.meshv2.v2.MeshV2Node
import com.sosmesh.android.meshv2.v2.MeshV2Runtime
import com.sosmesh.android.meshv2.v2.SpkiEd25519Verifier
import com.sosmesh.android.meshv2.v2.TombstoneVerifier
import com.sosmesh.contracts.CryptoConfig
import com.sosmesh.contracts.transport.EnqueueInput
import com.sosmesh.contracts.transport.OutboxEntryMeta
import com.sosmesh.contracts.transport.OutboxQueueAdapter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class WearSosViewModelPhoneUnreachableTest {
    private val testDispatcher = StandardTestDispatcher()
    
    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
    }

    @Test
    fun whenPhoneUnreachable_sendsViaMesh_showsCorrectStatus() = runTest {
        val store = InMemoryWearOfflineQueueStore()
        val transport = UnreachableTransport()
        val coordinator = WearSosCoordinator(store, transport)
        val fakeOutbox = FakeOutbox()
        val fakeMeshNode = createFakeMeshNode()
        val fakeMeshRuntime = FakeMeshRuntime(fakeMeshNode)
        val fakeRadio = FakeBleMeshRadio()
        val fakeComposer = FakeSosMessageComposer()
        
        val viewModel =
            WearSosViewModel(
                companionCoordinator = coordinator,
                companionTransport = transport,
                meshRuntime = fakeMeshRuntime,
                bleMeshRadio = fakeRadio,
                sosComposer = fakeComposer,
                outbox = fakeOutbox,
            )

        viewModel.onSosPressStart()
        viewModel.onSosPressRelease()
        viewModel.onConfirmSend(nowMs = 100L)
        advanceUntilIdle()
        
        viewModel.refreshStatus(nowMs = 101L)

        assertEquals(1, fakeOutbox.enqueueCount)
        assertEquals("wear_mesh", fakeOutbox.lastOrigin)
        assertEquals(1, fakeRadio.startDiscoveryCount)
        assertFalse(viewModel.showsFalseSuccess)
    }

    private fun createFakeMeshNode(): MeshV2Node =
        MeshV2Node(
            carry = CarryStore(maxItems = 20, maxBytes = 256 * 1024),
            verifier = TombstoneVerifier(SpkiEd25519Verifier("")),
            selfDeviceIdHash = "test-hash",
            relayIdHex = "a".repeat(64),
            isWatch = true,
        )

    private class UnreachableTransport : WearCompanionTransport {
        override fun isPhoneReachable(): Boolean = false

        override fun sendCreateToPhone(
            payload: ByteArray,
            onSuccess: () -> Unit,
            onFailure: (String) -> Unit,
        ) {
            onFailure("phone_not_reachable")
        }

        override fun sendCreateToNode(
            nodeId: String,
            payload: ByteArray,
            onSuccess: () -> Unit,
            onFailure: (String) -> Unit,
        ) {
            sendCreateToPhone(payload, onSuccess, onFailure)
        }
    }

    private class FakeOutbox : OutboxQueueAdapter {
        var enqueueCount = 0
        var lastOrigin: String? = null

        override suspend fun enqueue(
            input: EnqueueInput,
            nowMs: Long,
        ): OutboxEntryMeta {
            enqueueCount++
            lastOrigin = input.origin
            return OutboxEntryMeta(
                sosId = input.sosId,
                digest = input.digest,
                origin = input.origin,
                encryptedBlobBase64 = input.encryptedBlobBase64,
                state = "LOCAL_SAVED",
                retryAt = nowMs,
                lastError = null,
                peerReceivedCount = 0,
                updatedAt = nowMs,
            )
        }

        override suspend fun getByKey(
            sosId: String,
            digest: String,
        ): OutboxEntryMeta? = null

        override suspend fun setRetryAt(
            sosId: String,
            digest: String,
            retryAt: Long,
            reason: String,
        ) {
        }

        override suspend fun setPeerReceived(
            sosId: String,
            digest: String,
            count: Int,
            nowMs: Long,
        ) {
        }

        override suspend fun deleteEntry(
            sosId: String,
            digest: String,
        ): Boolean = false
    }

    private class FakeMeshRuntime(override val node: MeshV2Node) : MeshV2Runtime(
        MeshV2Config(
            relayIdHex = "a".repeat(64),
            receiptVerifyPublicKeySpkiBase64 = "",
            isWatch = true,
        ),
    )

    private class FakeBleMeshRadio : BleMeshRadio {
        var startDiscoveryCount = 0

        override fun startPeerDiscovery(foregroundVisible: Boolean): Result<Unit> {
            startDiscoveryCount++
            return Result.success(Unit)
        }

        override fun stopPeerDiscovery() {}

        override fun refreshStatus(): BleRadioStatus =
            BleRadioStatus(
                bluetoothEnabled = true,
                permissionsGranted = true,
                locationServicesOk = true,
                scanning = false,
                advertising = false,
                peerCount = 0,
                gattState = GattUiConnectionState.NONE,
                statusMessage = "test",
            )

        override fun connectFirstDiscoveredPeer(): Result<Unit> = Result.success(Unit)

        override fun connectBestPeer(exclude: Set<String>): Result<String> = Result.success("test")

        override fun connectedPeerId(): String? = null

        override fun peerHops(): Map<String, Int> = emptyMap()

        override fun disconnectPeerSession() {}

        override fun tickGattReconnect(): Result<Unit>? = null
    }

    private class FakeSosMessageComposer : SosMessageComposer(
        CryptoConfig(
            keyId = "test-key",
            serverPublicKey = "test",
        ),
    ) {
        override fun compose(request: SosComposeRequest) =
            super.compose(
                request.copy(
                    sender = null,
                    location = null,
                ),
            )
    }
}


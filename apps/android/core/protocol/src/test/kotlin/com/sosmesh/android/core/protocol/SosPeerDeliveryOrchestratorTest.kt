package com.sosmesh.android.core.protocol

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.sosmesh.android.core.ble.BleMeshRadio
import com.sosmesh.android.core.ble.BleRadioStatus
import com.sosmesh.android.core.ble.GattUiConnectionState
import com.sosmesh.android.core.data.fixtures.AndroidStateTransitionLoader
import com.sosmesh.android.core.data.outbox.OutboxDatabase
import com.sosmesh.android.core.data.outbox.RoomOutboxQueueAdapter
import com.sosmesh.android.core.data.outbox.SosOutboxReader
import com.sosmesh.android.core.permissions.PermissionFlowCoordinator
import com.sosmesh.android.core.permissions.PermissionStatusReader
import com.sosmesh.contracts.transport.EnqueueInput
import com.sosmesh.ble.BleProtocol
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.util.Base64

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class SosPeerDeliveryOrchestratorTest {
    private lateinit var db: OutboxDatabase
    private lateinit var adapter: RoomOutboxQueueAdapter
    private lateinit var reader: SosOutboxReader
    private lateinit var radio: FakeRadio
    private lateinit var engine: FakeEngine
    private lateinit var orchestrator: SosPeerDeliveryOrchestrator

    @Before
    fun setUp() {
        db =
            Room.inMemoryDatabaseBuilder(
                ApplicationProvider.getApplicationContext(),
                OutboxDatabase::class.java,
            ).allowMainThreadQueries().build()
        val fixture =
            AndroidStateTransitionLoader.load(
                javaClass.classLoader!!.getResourceAsStream("state-transitions.json")!!,
            )
        adapter = RoomOutboxQueueAdapter(db.outboxDao(), fixture.defaultRetentionMs, Dispatchers.IO)
        reader = SosOutboxReader(db.outboxDao(), Dispatchers.IO)
        radio = FakeRadio()
        engine = FakeEngine()
        orchestrator =
            SosPeerDeliveryOrchestrator(
                outboxReader = reader,
                outbox = adapter,
                engine = engine,
                radio = radio,
                permissions = testGrantAllPermissionCoordinator(),
                bleMeshReadiness = testGrantAllBleMeshReadiness(),
                ioDispatcher = testIoDispatcher(),
            )
    }

    @After
    fun tearDown() {
        db.close()
    }

    @Test
    fun permissionsMissing_doesNotStartDiscovery() =
        runBlocking {
            val deniedPermissions = permissionsMissing("android.permission.BLUETOOTH_SCAN")
            val denied =
                SosPeerDeliveryOrchestrator(
                    outboxReader = reader,
                    outbox = adapter,
                    engine = engine,
                    radio = radio,
                    permissions = deniedPermissions,
                    bleMeshReadiness = testBleMeshReadiness(deniedPermissions),
                    ioDispatcher = testIoDispatcher(),
                )
            enqueueAndroidPayload("sos-1", byteArrayOf(1, 2, 3), nowMs = 1L)
            val result = denied.runCycle(nowMs = 1L, foregroundVisible = true)
            assertTrue(result is SosPeerDeliveryCycleResult.PermissionsMissing)
            assertEquals(0, radio.startDiscoveryCalls)
        }

    @Test
    fun sendDueEntry_triggersTransferWhenGattReady() =
        runBlocking {
            val payload = """{"id":"abc","version":1}""".toByteArray()
            enqueueAndroidPayload("abc", payload, nowMs = 1L)
            radio.gattState = GattUiConnectionState.READY
            val result = orchestrator.runCycle(nowMs = 1L, foregroundVisible = true)
            assertEquals(SosPeerDeliveryCycleResult.TransferStarted, result)
            assertEquals(1, engine.sendOutboundCalls.size)
            assertEquals("abc", engine.sendOutboundCalls.single().sosId)
            assertTrue(payload.contentEquals(engine.sendOutboundCalls.single().payload))
        }

    @Test
    fun digestMismatch_schedulesRetryWithoutSend() =
        runBlocking {
            adapter.enqueue(
                EnqueueInput(
                    sosId = "bad",
                    digest = "wrong-digest",
                    origin = "android",
                    encryptedBlobBase64 = Base64.getEncoder().encodeToString(byteArrayOf(9)),
                ),
                1L,
            )
            radio.gattState = GattUiConnectionState.READY
            val result = orchestrator.runCycle(nowMs = 10L, foregroundVisible = true)
            assertTrue(result is SosPeerDeliveryCycleResult.Blocked)
            assertEquals(0, engine.sendOutboundCalls.size)
            assertEquals("digest_mismatch", adapter.getByKey("bad", "wrong-digest")?.lastError)
        }

    @Test
    fun senderBusy_skipsSecondSend() =
        runBlocking {
            enqueueAndroidPayload("a", byteArrayOf(1), nowMs = 1L)
            engine.senderStateValue = TransferState.SENDING
            val result = orchestrator.runCycle(nowMs = 1L, foregroundVisible = true)
            assertEquals(SosPeerDeliveryCycleResult.SenderBusy, result)
        }

    private suspend fun enqueueAndroidPayload(
        sosId: String,
        payload: ByteArray,
        nowMs: Long,
    ) {
        val digest = Base64.getEncoder().encodeToString(BleProtocol.calculateSHA256(payload))
        adapter.enqueue(
            EnqueueInput(
                sosId = sosId,
                digest = digest,
                origin = "android",
                encryptedBlobBase64 = Base64.getEncoder().encodeToString(payload),
            ),
            nowMs,
        )
    }

    private class FakeEngine : BleTransferEnginePort {
        val sendOutboundCalls = mutableListOf<SendCall>()
        var senderStateValue: TransferState = TransferState.IDLE

        data class SendCall(
            val sosId: String,
            val digest: String,
            val payload: ByteArray,
        )

        override fun sendOutbound(
            sosId: String,
            digest: String,
            payload: ByteArray,
        ) {
            sendOutboundCalls.add(SendCall(sosId, digest, payload))
        }

        override fun sendOpaqueForward(payload: ByteArray) = Unit

        override fun onGattReady() = Unit

        override fun senderState(): TransferState = senderStateValue
    }

    private class FakeRadio : BleMeshRadio {
        var gattState: GattUiConnectionState = GattUiConnectionState.NONE
        var startDiscoveryCalls = 0
        var peerCount = 1

        override fun startPeerDiscovery(foregroundVisible: Boolean): Result<Unit> {
            startDiscoveryCalls++
            return Result.success(Unit)
        }

        override fun stopPeerDiscovery() = Unit

        override fun refreshStatus(): BleRadioStatus =
            BleRadioStatus(
                bluetoothEnabled = true,
                permissionsGranted = true,
                locationServicesOk = true,
                scanning = true,
                advertising = true,
                peerCount = peerCount,
                gattState = gattState,
                statusMessage = "test",
            )

        override fun connectFirstDiscoveredPeer(): Result<Unit> = Result.success(Unit)

        override fun disconnectPeerSession() = Unit

        override fun tickGattReconnect(): Result<Unit>? = null
    }

    private fun permissionsMissing(vararg denied: String): PermissionFlowCoordinator {
        val deniedSet = denied.toSet()
        return PermissionFlowCoordinator(
            sdkInt = 33,
            statusReader =
                object : PermissionStatusReader {
                    override fun isGranted(permission: String): Boolean = permission !in deniedSet

                    override fun shouldShowRationale(permission: String): Boolean = false
                },
        )
    }
}

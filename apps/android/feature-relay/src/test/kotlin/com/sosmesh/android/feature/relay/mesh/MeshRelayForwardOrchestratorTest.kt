package com.sosmesh.android.feature.relay.mesh

import com.sosmesh.android.core.ble.BleMeshRadio
import com.sosmesh.android.core.ble.BleRadioStatus
import com.sosmesh.android.core.ble.GattUiConnectionState
import com.sosmesh.android.core.permissions.PermissionFlowCoordinator
import com.sosmesh.android.core.permissions.PermissionStatusReader
import com.sosmesh.android.core.protocol.BleTransferEnginePort
import com.sosmesh.android.core.protocol.TransferState
import com.sosmesh.android.feature.relay.testBleMeshReadiness
import com.sosmesh.android.feature.relay.testGrantAllBleMeshReadiness
import com.sosmesh.android.feature.relay.testGrantAllPermissionCoordinator
import com.sosmesh.android.feature.relay.testIoDispatcher
import com.sosmesh.android.meshv2.MeshForwardQueue
import com.sosmesh.android.meshv2.MeshRouteSelector
import com.sosmesh.android.meshv2.MeshV2RelayAction
import com.sosmesh.android.meshv2.MeshV2RelayCoordinator
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class MeshRelayForwardOrchestratorTest {
    private lateinit var meshV2: MeshV2RelayCoordinator
    private lateinit var radio: FakeRadio
    private lateinit var engine: FakeEngine
    private lateinit var orchestrator: MeshRelayForwardOrchestrator

    private val relayHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

    @Before
    fun setUp() {
        meshV2 =
            MeshV2RelayCoordinator(
                forwardQueue = MeshForwardQueue(maxDepth = 4),
                routeSelector = MeshRouteSelector(),
            )
        radio = FakeRadio()
        engine = FakeEngine()
        orchestrator =
            MeshRelayForwardOrchestrator(
                meshV2RelayCoordinator = meshV2,
                engine = engine,
                radio = radio,
                permissions = testGrantAllPermissionCoordinator(),
                bleMeshReadiness = testGrantAllBleMeshReadiness(),
                ioDispatcher = testIoDispatcher(),
            )
    }

    @Test
    fun forwardCycle_sendsOpaqueBytesWithoutOutboundTrackerFields() =
        runBlocking {
            val payload =
                """
                {
                  "protocolVersion": 2,
                  "messageId": "fwd-1",
                  "hopCount": 0,
                  "maxHops": 5,
                  "ttlHops": 2,
                  "copyCount": 1,
                  "maxCopyCount": 3,
                  "originCreatedAt": "2026-11-01T12:00:00Z",
                  "opaqueCiphertextBase64": "AQIDBA==",
                  "hopChainReceipt": { "relayDeviceIdHashes": [] }
                }
                """.trimIndent().toByteArray()
            val ingest =
                meshV2.onWirePayload(
                    payload = payload,
                    relayDeviceIdHash = relayHash,
                    nowMs = 1L,
                    batteryQuotaAllowsForward = true,
                    uplinkInternetAvailable = false,
                )
            assertEquals(MeshV2RelayAction.QueuedForForward, ingest.action)
            radio.gattState = GattUiConnectionState.READY
            val result = orchestrator.runForwardCycle(foregroundVisible = true)
            assertEquals(MeshRelayForwardCycleResult.ForwardStarted, result)
            assertEquals(1, engine.opaqueCalls.size)
            assertTrue(engine.opaqueCalls.single().isNotEmpty())
        }

    @Test
    fun permissionsMissing_blocksForward() =
        runBlocking {
            val deniedPermissions = permissionsMissing("android.permission.BLUETOOTH_CONNECT")
            val denied =
                MeshRelayForwardOrchestrator(
                    meshV2RelayCoordinator = meshV2,
                    engine = engine,
                    radio = radio,
                    permissions = deniedPermissions,
                    bleMeshReadiness = testBleMeshReadiness(deniedPermissions),
                    ioDispatcher = testIoDispatcher(),
                )
            val payload =
                """
                {
                  "protocolVersion": 2,
                  "messageId": "fwd-2",
                  "hopCount": 0,
                  "maxHops": 5,
                  "ttlHops": 2,
                  "copyCount": 1,
                  "maxCopyCount": 3,
                  "originCreatedAt": "2026-11-01T12:00:00Z",
                  "opaqueCiphertextBase64": "AQIDBA==",
                  "hopChainReceipt": { "relayDeviceIdHashes": [] }
                }
                """.trimIndent().toByteArray()
            meshV2.onWirePayload(
                payload = payload,
                relayDeviceIdHash = relayHash,
                nowMs = 1L,
                batteryQuotaAllowsForward = true,
                uplinkInternetAvailable = false,
            )
            val result = denied.runForwardCycle(foregroundVisible = true)
            assertTrue(result is MeshRelayForwardCycleResult.PermissionsMissing)
            assertEquals(0, engine.opaqueCalls.size)
        }

    private class FakeEngine : BleTransferEnginePort {
        val opaqueCalls = mutableListOf<ByteArray>()

        override fun sendOutbound(
            sosId: String,
            digest: String,
            payload: ByteArray,
        ) = Unit

        override fun sendOpaqueForward(payload: ByteArray) {
            opaqueCalls.add(payload.copyOf())
        }

        override fun onGattReady() = Unit

        override fun senderState(): TransferState = TransferState.IDLE
    }

    private class FakeRadio : BleMeshRadio {
        var gattState: GattUiConnectionState = GattUiConnectionState.NONE

        override fun startPeerDiscovery(foregroundVisible: Boolean): Result<Unit> = Result.success(Unit)

        override fun stopPeerDiscovery() = Unit

        override fun refreshStatus(): BleRadioStatus =
            BleRadioStatus(
                bluetoothEnabled = true,
                permissionsGranted = true,
                locationServicesOk = true,
                scanning = true,
                advertising = true,
                peerCount = 1,
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

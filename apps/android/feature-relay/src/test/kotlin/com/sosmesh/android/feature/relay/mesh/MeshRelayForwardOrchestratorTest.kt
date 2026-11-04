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
    private lateinit var meshV2: com.sosmesh.android.meshv2.v2.MeshV2Runtime
    private val l2 = """{"version":1,"id":"fwd-1","envelope":{"timestamp":"2026-11-01T12:00:00Z","priority":1},"encryptedPayload":"x"}"""
    private val outbox =
        FakeListOutbox(
            listOf(
                com.sosmesh.contracts.transport.OutboxEntryMeta(
                    sosId = "fwd-1",
                    digest = "d",
                    origin = "relay",
                    encryptedBlobBase64 = java.util.Base64.getEncoder().encodeToString(l2.toByteArray()),
                    state = "LOCAL_SAVED",
                    retryAtMs = 0,
                    expiresAtMs = Long.MAX_VALUE,
                    lastError = null,
                    createdAtMs = 0,
                    updatedAtMs = 0,
                ),
            ),
        )
    private lateinit var radio: FakeRadio
    private lateinit var engine: FakeEngine
    private lateinit var orchestrator: MeshRelayForwardOrchestrator

    private val relayHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

    @Before
    fun setUp() {
        meshV2 = com.sosmesh.android.meshv2.v2.MeshV2Runtime(com.sosmesh.android.meshv2.v2.MeshV2Config(relayHash, ""))
        meshV2.carryMeta.put(
            "fwd-1",
            com.sosmesh.android.meshv2.v2.CarryMetaStore.Meta(
                receivedHopCount = 1,
                originCreatedAtMs = System.currentTimeMillis(),
                receivedAtMs = System.currentTimeMillis(),
            ),
        )
        radio = FakeRadio()
        engine = FakeEngine()
        orchestrator =
            MeshRelayForwardOrchestrator(
                outbox = outbox,
                    meshV2 = meshV2,
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
                    outbox = outbox,
                    meshV2 = meshV2,
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

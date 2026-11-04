package com.sosmesh.android.wear.mesh

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.sosmesh.android.core.ble.BleMeshRadio
import com.sosmesh.android.core.ble.BleRadioStatus
import com.sosmesh.android.core.ble.GattUiConnectionState
import com.sosmesh.android.core.permissions.PermissionFlowCoordinator
import com.sosmesh.android.core.permissions.PermissionStatusReader
import com.sosmesh.android.meshv2.v2.CarryStore
import com.sosmesh.android.meshv2.v2.MeshV2Config
import com.sosmesh.android.meshv2.v2.MeshV2Node
import com.sosmesh.android.meshv2.v2.MeshV2Runtime
import com.sosmesh.android.meshv2.v2.SpkiEd25519Verifier
import com.sosmesh.android.meshv2.v2.TombstoneVerifier
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class WearRelayToggleTest {
    @Test
    fun startRelay_enablesNodeAndStartsBle() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val fakeMeshNode = createFakeMeshNode()
        val fakeMeshRuntime = FakeMeshRuntime(fakeMeshNode)
        val fakeRadio = FakeBleMeshRadio()
        val fakePermissions = FakePermissionFlowCoordinator()
        
        val coordinator =
            WearMeshCoordinator(
                context = context,
                meshRuntime = fakeMeshRuntime,
                bleMeshRadio = fakeRadio,
                permissionFlowCoordinator = fakePermissions,
            )

        assertFalse(coordinator.isRelayActive())
        assertFalse(fakeMeshNode.relayEnabled)

        val result = coordinator.startRelay()

        assertTrue(result.isSuccess)
        assertTrue(coordinator.isRelayActive())
        assertTrue(fakeMeshNode.relayEnabled)
        assertEquals(1, fakeRadio.startDiscoveryCount)
    }

    @Test
    fun stopRelay_disablesNodeAndStopsBle() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val fakeMeshNode = createFakeMeshNode()
        val fakeMeshRuntime = FakeMeshRuntime(fakeMeshNode)
        val fakeRadio = FakeBleMeshRadio()
        val fakePermissions = FakePermissionFlowCoordinator()
        
        val coordinator =
            WearMeshCoordinator(
                context = context,
                meshRuntime = fakeMeshRuntime,
                bleMeshRadio = fakeRadio,
                permissionFlowCoordinator = fakePermissions,
            )

        coordinator.startRelay()
        assertTrue(coordinator.isRelayActive())

        coordinator.stopRelay()

        assertFalse(coordinator.isRelayActive())
        assertFalse(fakeMeshNode.relayEnabled)
        assertEquals(1, fakeRadio.stopDiscoveryCount)
    }

    @Test
    fun getMissingPermissions_returnsPermissionsFromCoordinator() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val fakeMeshNode = createFakeMeshNode()
        val fakeMeshRuntime = FakeMeshRuntime(fakeMeshNode)
        val fakeRadio = FakeBleMeshRadio()
        val fakePermissions = FakePermissionFlowCoordinator(missing = listOf("BLUETOOTH_SCAN", "BLUETOOTH_CONNECT"))
        
        val coordinator =
            WearMeshCoordinator(
                context = context,
                meshRuntime = fakeMeshRuntime,
                bleMeshRadio = fakeRadio,
                permissionFlowCoordinator = fakePermissions,
            )

        val missing = coordinator.getMissingPermissions()
        assertEquals(2, missing.size)
        assertTrue(missing.contains("BLUETOOTH_SCAN"))
        assertTrue(missing.contains("BLUETOOTH_CONNECT"))
    }

    private fun createFakeMeshNode(): MeshV2Node =
        MeshV2Node(
            carry = CarryStore(maxItems = 20, maxBytes = 256 * 1024),
            verifier = TombstoneVerifier(SpkiEd25519Verifier("")),
            selfDeviceIdHash = "test-hash",
            relayIdHex = "a".repeat(64),
            isWatch = true,
        )

    private class FakeMeshRuntime(override val node: MeshV2Node) : MeshV2Runtime(
        MeshV2Config(
            relayIdHex = "a".repeat(64),
            receiptVerifyPublicKeySpkiBase64 = "",
            isWatch = true,
        ),
    )

    private class FakeBleMeshRadio : BleMeshRadio {
        var startDiscoveryCount = 0
        var stopDiscoveryCount = 0

        override fun startPeerDiscovery(foregroundVisible: Boolean): Result<Unit> {
            startDiscoveryCount++
            return Result.success(Unit)
        }

        override fun stopPeerDiscovery() {
            stopDiscoveryCount++
        }

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

    private class FakePermissionFlowCoordinator(
        private val missing: List<String> = emptyList(),
    ) : PermissionFlowCoordinator(
            sdkInt = android.os.Build.VERSION.SDK_INT,
            statusReader =
                object : PermissionStatusReader {
                    override fun isGranted(permission: String): Boolean = !missing.contains(permission)

                    override fun shouldShowRationale(permission: String): Boolean = false
                },
        )
}

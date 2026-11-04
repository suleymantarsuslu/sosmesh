package com.sosmesh.android.feature.relay

import androidx.test.core.app.ApplicationProvider
import com.sosmesh.android.core.ble.BleMeshRadio
import com.sosmesh.android.core.ble.BleRadioStatus
import com.sosmesh.android.core.ble.GattUiConnectionState
import com.sosmesh.android.core.protocol.BleTransferEnginePort
import com.sosmesh.android.core.protocol.TransferState
import com.sosmesh.android.feature.relay.battery.RelayBatteryPolicy
import com.sosmesh.android.feature.relay.battery.RelayBatterySnapshot
import com.sosmesh.android.feature.relay.battery.RelayPauseReason
import com.sosmesh.android.feature.relay.mesh.MeshRelayForwardOrchestrator
import com.sosmesh.android.feature.relay.session.RelayForegroundLauncher
import com.sosmesh.android.feature.relay.session.RelaySessionController
import com.sosmesh.android.feature.relay.settings.RelayHourlyDataBudget
import com.sosmesh.android.feature.relay.settings.RelaySettingsStore
import com.sosmesh.android.feature.relay.upload.RelayUploadCommands
import com.sosmesh.android.meshv2.MeshForwardQueue
import com.sosmesh.android.meshv2.MeshRouteSelector
import com.sosmesh.android.meshv2.MeshV2RelayCoordinator
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class RelaySessionControllerTest {
    private val context = ApplicationProvider.getApplicationContext<android.content.Context>()
    private lateinit var settings: RelaySettingsStore
    private lateinit var radio: TrackingBleMeshRadio
    private lateinit var upload: RecordingUploadCommands
    private lateinit var foreground: RecordingForegroundLauncher
    private lateinit var controller: RelaySessionController

    @Before
    fun setUp() {
        context.getSharedPreferences(RelaySettingsStore.PREFS_NAME, android.content.Context.MODE_PRIVATE)
            .edit()
            .clear()
            .commit()
        settings = RelaySettingsStore(context)
        settings.setRelayEnabled(false)
        radio = TrackingBleMeshRadio()
        upload = RecordingUploadCommands()
        foreground = RecordingForegroundLauncher()
        val budget = RelayHourlyDataBudget(context)
        budget.resetForTests()
        val policy = RelayBatteryPolicy(settings, budget)
        val meshForward =
            MeshRelayForwardOrchestrator(
                outbox = com.sosmesh.android.feature.relay.mesh.EmptyOutboxForTests,
                meshV2 = com.sosmesh.android.meshv2.v2.MeshV2Runtime(com.sosmesh.android.meshv2.v2.MeshV2Config("a".repeat(64), "")),
                engine = NoOpTransferEngine(),
                radio = radio,
                permissions = testGrantAllPermissionCoordinator(),
                bleMeshReadiness = testGrantAllBleMeshReadiness(),
                ioDispatcher = testIoDispatcher(),
            )
        controller =
            RelaySessionController(
                settings,
                policy,
                radio,
                foreground,
                upload,
                meshForward,
                testIoDispatcher(),
            )
    }

    @Test
    fun toggleOff_doesNotStartScanOrUpload() =
        runBlocking {
            settings.setRelayEnabled(false)
            controller.refresh(RelayBatterySnapshot(80, false), screenVisible = true, nowMs = 100L)
            assertEquals(0, radio.startCount)
            assertEquals(0, upload.scheduleCount)
            assertEquals(0, foreground.startCount)
        }

    @Test
    fun toggleOn_startsForegroundScanAndUploadSchedule() =
        runBlocking {
            settings.setRelayEnabled(true)
            val status = controller.refresh(RelayBatterySnapshot(80, false), screenVisible = true, nowMs = 100L)
            assertTrue(status.running)
            assertEquals(1, radio.startCount)
            assertEquals(1, upload.scheduleCount)
            assertEquals(1, foreground.startCount)
        }

    @Test
    fun batteryLow_stopsSessionAndShowsReason() =
        runBlocking {
            settings.setRelayEnabled(true)
            controller.refresh(RelayBatterySnapshot(80, false), screenVisible = true, nowMs = 100L)
            val status = controller.refresh(RelayBatterySnapshot(5, false), screenVisible = true, nowMs = 200L)
            assertFalse(status.running)
            assertEquals(RelayPauseReason.BatteryBelowThreshold, status.pauseReason)
            assertTrue(radio.stopCount >= 1)
        }

    private class TrackingBleMeshRadio : BleMeshRadio {
        var startCount = 0
        var stopCount = 0

        override fun startPeerDiscovery(foregroundVisible: Boolean): Result<Unit> {
            startCount++
            return Result.success(Unit)
        }

        override fun stopPeerDiscovery() {
            stopCount++
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

        override fun disconnectPeerSession() = Unit

        override fun tickGattReconnect(): Result<Unit>? = null
    }

    private class NoOpTransferEngine : BleTransferEnginePort {
        override fun sendOutbound(
            sosId: String,
            digest: String,
            payload: ByteArray,
        ) = Unit

        override fun sendOpaqueForward(payload: ByteArray) = Unit

        override fun onGattReady() = Unit

        override fun senderState(): TransferState = TransferState.IDLE
    }

    private class RecordingUploadCommands : RelayUploadCommands {
        var scheduleCount = 0
        var cancelCount = 0

        override fun scheduleUpload(
            nowMs: Long,
            delayMs: Long,
        ) {
            scheduleCount++
        }

        override fun cancelUpload() {
            cancelCount++
        }
    }

    private class RecordingForegroundLauncher : RelayForegroundLauncher {
        var startCount = 0
        var stopCount = 0

        override fun startForegroundRelay() {
            startCount++
        }

        override fun stopForegroundRelay() {
            stopCount++
        }
    }
}

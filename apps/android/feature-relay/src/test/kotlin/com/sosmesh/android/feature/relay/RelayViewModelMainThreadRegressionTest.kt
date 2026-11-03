package com.sosmesh.android.feature.relay

import androidx.arch.core.executor.testing.InstantTaskExecutorRule
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.sosmesh.android.core.ble.BleMeshRadio
import com.sosmesh.android.core.ble.BleRadioStatus
import com.sosmesh.android.core.ble.GattUiConnectionState
import com.sosmesh.android.core.data.outbox.OutboxDatabase
import com.sosmesh.android.core.data.outbox.RelayOutboxReader
import com.sosmesh.android.core.permissions.PermissionFlowCoordinator
import com.sosmesh.android.core.permissions.PermissionStatusReader
import com.sosmesh.android.core.protocol.BleTransferEnginePort
import com.sosmesh.android.core.protocol.TransferState
import com.sosmesh.android.feature.relay.battery.RelayBatteryPolicy
import com.sosmesh.android.feature.relay.battery.RelayBatterySnapshotReader
import com.sosmesh.android.feature.relay.mesh.MeshRelayForwardOrchestrator
import com.sosmesh.android.feature.relay.session.RelayForegroundLauncher
import com.sosmesh.android.feature.relay.session.RelaySessionController
import com.sosmesh.android.feature.relay.settings.RelayHourlyDataBudget
import com.sosmesh.android.feature.relay.settings.RelaySettingsStore
import com.sosmesh.android.feature.relay.system.RelaySystemConstraints
import com.sosmesh.android.feature.relay.upload.RelayUploadCommands
import com.sosmesh.android.meshv2.MeshForwardQueue
import com.sosmesh.android.meshv2.MeshRouteSelector
import com.sosmesh.android.meshv2.MeshV2RelayCoordinator
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class RelayViewModelMainThreadRegressionTest {
    @get:Rule
    val instantTaskExecutorRule = InstantTaskExecutorRule()

    private val context = ApplicationProvider.getApplicationContext<android.content.Context>()
    private lateinit var db: OutboxDatabase
    private lateinit var viewModel: RelayViewModel

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        context.getSharedPreferences(RelaySettingsStore.PREFS_NAME, android.content.Context.MODE_PRIVATE)
            .edit()
            .clear()
            .commit()
        db =
            Room.inMemoryDatabaseBuilder(context, OutboxDatabase::class.java)
                .build()
        val settings = RelaySettingsStore(context)
        settings.setRelayEnabled(false)
        val budget = RelayHourlyDataBudget(context)
        budget.resetForTests()
        val policy = RelayBatteryPolicy(settings, budget)
        val radio = NoOpBleMeshRadio()
        val meshForward =
            MeshRelayForwardOrchestrator(
                meshV2RelayCoordinator =
                    MeshV2RelayCoordinator(
                        forwardQueue = MeshForwardQueue(maxDepth = 4),
                        routeSelector = MeshRouteSelector(),
                    ),
                engine = NoOpTransferEngine(),
                radio = radio,
                permissions = testGrantAllPermissionCoordinator(),
                bleMeshReadiness = testGrantAllBleMeshReadiness(),
                ioDispatcher = testIoDispatcher(),
            )
        val session =
            RelaySessionController(
                settings,
                policy,
                radio,
                NoOpForegroundLauncher(),
                NoOpUploadCommands(),
                meshForward,
                testIoDispatcher(),
            )
        viewModel =
            RelayViewModel(
                settings = settings,
                sessionController = session,
                batteryReader = RelayBatterySnapshotReader(context),
                batteryPolicy = policy,
                outboxReader = RelayOutboxReader(db.outboxDao(), Dispatchers.IO),
                systemConstraints = RelaySystemConstraints(context),
            )
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
        db.close()
    }

    @Test
    fun initRefresh_withoutAllowMainThreadQueries_completes() =
        runTest {
            advanceUntilIdle()
            assertEquals(0, viewModel.uiState.value.pendingUploadCount)
        }

    private fun grantAllPermissions(): PermissionFlowCoordinator = testGrantAllPermissionCoordinator()

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

    private class NoOpBleMeshRadio : BleMeshRadio {
        override fun startPeerDiscovery(foregroundVisible: Boolean): Result<Unit> = Result.success(Unit)

        override fun stopPeerDiscovery() = Unit

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

    private class NoOpUploadCommands : RelayUploadCommands {
        override fun scheduleUpload(
            nowMs: Long,
            delayMs: Long,
        ) = Unit

        override fun cancelUpload() = Unit
    }

    private class NoOpForegroundLauncher : RelayForegroundLauncher {
        override fun startForegroundRelay() = Unit

        override fun stopForegroundRelay() = Unit
    }
}

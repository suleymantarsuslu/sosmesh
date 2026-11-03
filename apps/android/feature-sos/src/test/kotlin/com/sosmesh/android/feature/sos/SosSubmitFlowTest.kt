package com.sosmesh.android.feature.sos

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.sosmesh.android.core.data.fixtures.AndroidStateTransitionLoader
import com.sosmesh.android.core.data.mesh.SosPeerDeliveryKickResult
import com.sosmesh.android.core.data.mesh.SosPeerDeliveryPort
import com.sosmesh.android.core.data.outbox.OutboxDatabase
import com.sosmesh.android.core.data.outbox.RoomOutboxQueueAdapter
import com.sosmesh.android.core.data.sos.DevTestCryptoConfig
import com.sosmesh.android.core.data.sos.LocationSnapshot
import com.sosmesh.android.core.data.sos.SosComposeRequest
import com.sosmesh.android.core.data.sos.SosMessageComposer
import com.sosmesh.android.core.model.SosType
import androidx.arch.core.executor.testing.InstantTaskExecutorRule
import com.sosmesh.android.feature.sos.location.DefaultSosLocationProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import org.junit.Rule
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class SosSubmitFlowTest {
    @get:Rule
    val instantTaskExecutorRule = InstantTaskExecutorRule()

    private lateinit var db: OutboxDatabase
    private lateinit var adapter: RoomOutboxQueueAdapter
    private lateinit var repository: SosSubmitRepository

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        db =
            Room.inMemoryDatabaseBuilder(context, OutboxDatabase::class.java)
                .allowMainThreadQueries()
                .build()
        val fixture =
            AndroidStateTransitionLoader.load(
                javaClass.classLoader!!.getResourceAsStream("state-transitions.json")!!,
            )
        adapter = RoomOutboxQueueAdapter(db.outboxDao(), fixture.defaultRetentionMs, Dispatchers.IO)
        repository =
            SosSubmitRepository(
                SosMessageComposer(DevTestCryptoConfig.config()),
                adapter,
                Dispatchers.IO,
            )
    }

    @After
    fun tearDown() {
        db.close()
    }

    private fun viewModel(): SosFormViewModel =
        SosFormViewModel(
            DefaultSosLocationProvider({ false }, { null }),
            repository,
            NoOpPeerDelivery,
            testGrantAllBleMeshReadiness(),
            testGrantAllPermissionCoordinator(),
        )

    @Test
    fun locationDenied_savesUnknownLocationToOutbox() =
        runBlocking {
            val vm = viewModel()
            vm.setPersonCountText("1")
            vm.goToPreview()
            vm.performSaveAfterPreview(nowMs = 1_700_000_000_000L)
            assertEquals(1, adapter.listAll().size)
            val entry = adapter.listAll().single()
            assertEquals("LOCAL_SAVED", entry.state)
            assertEquals("android", entry.origin)
            assertTrue(!vm.effectiveLocation().isKnown)
        }

    @Test
    fun backFromPreview_leavesOutboxEmpty() =
        runBlocking {
            val viewModel = viewModel()
            viewModel.goToPreview()
            viewModel.backFromPreview()
            assertEquals(0, adapter.listAll().size)
        }

    @Test
    fun invalidPersonCount_blocksOutbox() =
        runBlocking {
            val viewModel = viewModel()
            viewModel.setPersonCountText("0")
            viewModel.goToPreview()
            viewModel.confirmAndSave()
            assertEquals(0, adapter.listAll().size)
        }

    @Test
    fun confirm_writesSchemaValidMessage() =
        runBlocking {
            repository.submit(
                SosComposeRequest(
                    sosType = SosType.DIGER,
                    personCount = null,
                    note = "",
                    location = LocationSnapshot.unknown(),
                    languageTag = "en",
                    nowMs = 1_700_000_000_000L,
                ),
            )
            assertEquals(1, adapter.listAll().size)
        }

    private object NoOpPeerDelivery : SosPeerDeliveryPort {
        override suspend fun kickOffAfterLocalSave(
            nowMs: Long,
            foregroundVisible: Boolean,
        ): SosPeerDeliveryKickResult = SosPeerDeliveryKickResult.Idle

        override suspend fun runPendingCycle(
            nowMs: Long,
            foregroundVisible: Boolean,
        ): SosPeerDeliveryKickResult = SosPeerDeliveryKickResult.Idle
    }
}

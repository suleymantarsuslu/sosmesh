package com.sosmesh.android.feature.status

import androidx.arch.core.executor.testing.InstantTaskExecutorRule
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.sosmesh.android.core.data.fixtures.AndroidStateTransitionLoader
import com.sosmesh.android.core.data.mesh.SosPeerDeliveryKickResult
import com.sosmesh.android.core.data.mesh.SosPeerDeliveryPort
import com.sosmesh.android.core.data.outbox.OutboxDatabase
import com.sosmesh.android.core.data.outbox.RoomOutboxQueueAdapter
import com.sosmesh.contracts.transport.EnqueueInput
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
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
@Config(sdk = [30])
class StatusViewModelMainThreadRegressionTest {
    @get:Rule
    val instantTaskExecutorRule = InstantTaskExecutorRule()

    private lateinit var db: OutboxDatabase
    private lateinit var adapter: RoomOutboxQueueAdapter

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        db =
            Room.inMemoryDatabaseBuilder(context, OutboxDatabase::class.java)
                .build()
        val fixture =
            AndroidStateTransitionLoader.load(
                javaClass.classLoader!!.getResourceAsStream("state-transitions.json")!!,
            )
        adapter = RoomOutboxQueueAdapter(db.outboxDao(), fixture.defaultRetentionMs, Dispatchers.IO)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
        db.close()
    }

    @Test
    fun initRefresh_withoutAllowMainThreadQueries_loadsEntries() =
        runBlocking {
            runBlocking(Dispatchers.IO) {
                adapter.enqueue(
                    EnqueueInput(
                        sosId = "status-vm-test",
                        digest = "d",
                        origin = "android",
                        encryptedBlobBase64 = "e30=",
                    ),
                    nowMs = 1L,
                )
            }
            val viewModel =
                StatusViewModel(
                    outbox = adapter,
                    peerDelivery = NoOpPeerDeliveryPort,
                )
            val deadlineMs = System.currentTimeMillis() + 5_000
            while (viewModel.uiState.value.entries.isEmpty() && System.currentTimeMillis() < deadlineMs) {
                Thread.sleep(25)
            }
            assertEquals(1, viewModel.uiState.value.entries.size)
            assertEquals("status-vm-test", viewModel.uiState.value.entries.single().sosId)
        }

    private object NoOpPeerDeliveryPort : SosPeerDeliveryPort {
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

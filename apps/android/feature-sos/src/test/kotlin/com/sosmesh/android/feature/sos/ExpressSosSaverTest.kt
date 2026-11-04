package com.sosmesh.android.feature.sos

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.sosmesh.android.core.data.fixtures.AndroidStateTransitionLoader
import com.sosmesh.android.core.data.mesh.SosPeerDeliveryKickResult
import com.sosmesh.android.core.data.mesh.SosPeerDeliveryPort
import com.sosmesh.android.core.data.outbox.OutboxDatabase
import com.sosmesh.android.core.data.outbox.OutboxUploadScheduler
import com.sosmesh.android.core.data.outbox.RoomOutboxQueueAdapter
import com.sosmesh.android.core.data.sos.DevTestCryptoConfig
import com.sosmesh.android.core.data.sos.SosMessageComposer
import com.sosmesh.android.feature.sos.location.DefaultSosLocationProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class ExpressSosSaverTest {
    private lateinit var db: OutboxDatabase
    private lateinit var adapter: RoomOutboxQueueAdapter
    private lateinit var saver: ExpressSosSaver

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
        val repository =
            SosSubmitRepository(
                SosMessageComposer(DevTestCryptoConfig.config()),
                adapter,
                NoOpUploadScheduler,
                Dispatchers.IO,
                { null },
            )
        saver =
            ExpressSosSaver(
                DefaultSosLocationProvider({ false }, { null }),
                repository,
                NoOpSosPeerDeliveryPort,
                testGrantAllBleMeshReadiness(),
                testGrantAllPermissionCoordinator(),
                OpenCaseTracker(context),
            )
    }

    private object NoOpUploadScheduler : OutboxUploadScheduler {
        override fun scheduleUpload(
            nowMs: Long,
            delayMs: Long,
        ) {
        }

        override fun cancelUpload() {
        }
    }

    private object NoOpSosPeerDeliveryPort : SosPeerDeliveryPort {
        override suspend fun kickOffAfterLocalSave(
            nowMs: Long,
            foregroundVisible: Boolean,
        ): SosPeerDeliveryKickResult = SosPeerDeliveryKickResult.Idle

        override suspend fun runPendingCycle(
            nowMs: Long,
            foregroundVisible: Boolean,
        ): SosPeerDeliveryKickResult = SosPeerDeliveryKickResult.Idle
    }

    @After
    fun tearDown() {
        db.close()
    }

    @Test
    fun expressSave_enqueuesLocalSavedOnce() =
        runBlocking {
            val id = saver.save(nowMs = 1_700_000_000_000L)
            assertEquals(1, adapter.listAll().size)
            assertEquals("LOCAL_SAVED", adapter.listAll().single().state)
            assertEquals(id, adapter.listAll().single().sosId)
        }

    @Test
    fun expressSave_withinOpenCase_replacesUnsentPrevious() =
        runBlocking {
            val id1 = saver.save(nowMs = 1_700_000_000_000L)
            assertEquals(1, adapter.listAll().size)
            
            val id2 = saver.save(nowMs = 1_700_000_001_000L)
            val all = adapter.listAll()
            assertEquals(1, all.size)
            assertEquals(id2, all.single().sosId)
        }

    @Test
    fun expressSave_afterCaseExpired_createsNewEntry() =
        runBlocking {
            val id1 = saver.save(nowMs = 1_700_000_000_000L)
            assertEquals(1, adapter.listAll().size)
            
            val id2 = saver.save(nowMs = 1_700_000_000_000L + 25L * 3600_000L)
            val all = adapter.listAll()
            assertEquals(2, all.size)
        }
}

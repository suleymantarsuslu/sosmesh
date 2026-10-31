package com.sosmesh.android.feature.relay

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.sosmesh.android.core.data.fixtures.AndroidStateTransitionLoader
import com.sosmesh.android.core.data.outbox.OutboxDatabase
import com.sosmesh.android.core.data.outbox.RelayOutboxReader
import com.sosmesh.android.core.data.outbox.RoomOutboxQueueAdapter
import com.sosmesh.android.feature.relay.battery.RelayBatteryPolicy
import com.sosmesh.android.feature.relay.battery.RelayBatterySnapshot
import com.sosmesh.android.feature.relay.battery.RelayPauseReason
import com.sosmesh.android.feature.relay.settings.RelayHourlyDataBudget
import com.sosmesh.android.feature.relay.uplink.FakeRelayIngestUplink
import com.sosmesh.android.feature.relay.uplink.RelayIngestResult
import com.sosmesh.android.feature.relay.upload.RelayUploadExecutor
import com.sosmesh.contracts.transport.EnqueueInput
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class RelayUploadExecutorTest {
    private val context = ApplicationProvider.getApplicationContext<android.content.Context>()
    private lateinit var db: OutboxDatabase
    private lateinit var adapter: RoomOutboxQueueAdapter
    private lateinit var reader: RelayOutboxReader
    private lateinit var settings: MutableRelaySettings
    private lateinit var fakeUplink: FakeRelayIngestUplink
    private lateinit var executor: RelayUploadExecutor

    @Before
    fun setUp() {
        db =
            Room.inMemoryDatabaseBuilder(context, OutboxDatabase::class.java)
                .allowMainThreadQueries()
                .build()
        val fixture =
            AndroidStateTransitionLoader.load(
                javaClass.classLoader!!.getResourceAsStream("state-transitions.json")!!,
            )
        adapter = RoomOutboxQueueAdapter(db.outboxDao(), fixture.defaultRetentionMs)
        reader = RelayOutboxReader(db.outboxDao())
        settings = MutableRelaySettings(relayEnabled = true)
        val budget = RelayHourlyDataBudget(context)
        budget.resetForTests()
        fakeUplink = FakeRelayIngestUplink()
        val policy = RelayBatteryPolicy(settings, budget)
        executor = RelayUploadExecutor(settings, policy, budget, reader, adapter, fakeUplink)
    }

    @After
    fun tearDown() {
        db.close()
    }

    @Test
    fun noNetwork_schedulesRetryWithoutDeletingOutbox() {
        enqueueRelayBlob("net-1")
        val summary =
            executor.runUploadCycle(
                nowMs = 1_000L,
                networkConnected = false,
                battery = RelayBatterySnapshot(90, false),
            )
        assertNotNull(summary.scheduledRetryMs)
        val entry = adapter.getByKey("net-1", digestFor("net-1"))
        assertNotNull(entry)
        assertEquals("LOCAL_SAVED", entry!!.state)
        assertEquals("no_network", entry.lastError)
    }

    @Test
    fun fakeUplink200_updatesState() {
        enqueueRelayBlob("ok-1")
        fakeUplink.nextResult = RelayIngestResult.Success
        val summary =
            executor.runUploadCycle(
                nowMs = 2_000L,
                networkConnected = true,
                battery = RelayBatterySnapshot(90, false),
            )
        assertEquals(1, fakeUplink.uploadCallCount)
        assertEquals(1, summary.uploaded)
        val entry = adapter.getByKey("ok-1", digestFor("ok-1"))
        assertEquals("SERVER_ACCEPTED", entry!!.state)
    }

    @Test
    fun messageIdConflict_marksNeedsReviewWithoutDeletingOutbox() {
        enqueueRelayBlob("conflict-1")
        fakeUplink.nextResult = RelayIngestResult.MessageIdConflict
        executor.runUploadCycle(
            nowMs = 6_000L,
            networkConnected = true,
            battery = RelayBatterySnapshot(90, false),
        )
        val entry = adapter.getByKey("conflict-1", digestFor("conflict-1"))
        assertNotNull(entry)
        assertEquals("needs_review", entry!!.lastError)
        assertEquals("LOCAL_SAVED", entry.state)
    }

    @Test
    fun http429_appliesBackoff() {
        enqueueRelayBlob("rate-1")
        fakeUplink.nextResult = RelayIngestResult.RateLimited(retryAfterMs = 120_000L)
        val summary =
            executor.runUploadCycle(
                nowMs = 3_000L,
                networkConnected = true,
                battery = RelayBatterySnapshot(90, false),
            )
        assertNotNull(summary.scheduledRetryMs)
        val entry = adapter.getByKey("rate-1", digestFor("rate-1"))
        assertEquals("http_429", entry!!.lastError)
        assertEquals("LOCAL_SAVED", entry.state)
    }

    @Test
    fun hourlyLimit_defersUpload() {
        val limit = 64 * 1024L
        settings.hourlyLimitBytes = limit
        enqueueRelayBlob("limit-1", blobSize = 40)
        val budget = RelayHourlyDataBudget(context)
        budget.resetForTests()
        budget.recordSent((limit - 10).toInt(), 4_000L)
        val policy = RelayBatteryPolicy(settings, budget)
        executor = RelayUploadExecutor(settings, policy, budget, reader, adapter, fakeUplink)
        fakeUplink.nextResult = RelayIngestResult.Success
        val summary =
            executor.runUploadCycle(
                nowMs = 5_000L,
                networkConnected = true,
                battery = RelayBatterySnapshot(90, false),
            )
        assertEquals(RelayPauseReason.HourlyDataLimit, summary.deferredReason)
        val entry = adapter.getByKey("limit-1", digestFor("limit-1", 40))
        assertEquals("hourly_data_limit", entry!!.lastError)
    }

    private fun enqueueRelayBlob(
        sosId: String,
        blobSize: Int = 16,
    ) {
        val blob = "x".repeat(blobSize)
        adapter.enqueue(
            EnqueueInput(
                sosId = sosId,
                digest = digestFor(sosId, blobSize),
                origin = "relay",
                encryptedBlobBase64 = blob,
            ),
            nowMs = 1L,
        )
    }

    private fun digestFor(
        sosId: String,
        blobSize: Int = 16,
    ): String = "$sosId-$blobSize"
}

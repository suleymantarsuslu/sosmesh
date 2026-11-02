package com.sosmesh.android.core.data.outbox

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.sosmesh.contracts.transport.EnqueueInput
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
class OutboxAdim47CapacityTest {
    private lateinit var db: OutboxDatabase
    private lateinit var adapter: RoomOutboxQueueAdapter

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        db =
            Room.inMemoryDatabaseBuilder(context, OutboxDatabase::class.java)
                .allowMainThreadQueries()
                .build()
        adapter = RoomOutboxQueueAdapter(db.outboxDao(), defaultRetentionMs = 86_400_000L)
    }

    @After
    fun tearDown() {
        db.close()
    }

    @Test
    fun pendingEnvelopeQueue_holds1000DistinctRows() {
        repeat(1000) { index ->
            adapter.enqueue(
                EnqueueInput(
                    sosId = "adim47-$index",
                    digest = "digest-$index",
                    origin = "android-adim47",
                    encryptedBlobBase64 = "YQ==",
                ),
                nowMs = index.toLong(),
            )
        }
        assertEquals(1000, adapter.listAll().size)
    }

    @Test
    fun ttlPurge_simulatesLowStorageRecovery() {
        repeat(200) { index ->
            adapter.enqueue(
                EnqueueInput(
                    sosId = "ttl-$index",
                    digest = "d-$index",
                    origin = "android-adim47",
                    encryptedBlobBase64 = "Yg==",
                    retentionMs = 1_000,
                ),
                nowMs = 0,
            )
        }
        assertEquals(200, adapter.listAll().size)
        val purged = adapter.purgeExpired(nowMs = 2_000)
        assertEquals(200, purged)
        assertTrue(adapter.listAll().isEmpty())
    }
}

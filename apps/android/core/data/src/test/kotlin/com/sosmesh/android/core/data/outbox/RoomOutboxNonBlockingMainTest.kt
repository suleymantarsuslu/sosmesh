package com.sosmesh.android.core.data.outbox

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.sosmesh.contracts.transport.EnqueueInput
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Ensures [RoomOutboxQueueAdapter] does not block the main dispatcher while waiting on IO Room work.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [30])
class RoomOutboxNonBlockingMainTest {
    private lateinit var db: OutboxDatabase
    private lateinit var adapter: RoomOutboxQueueAdapter

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        db =
            Room.inMemoryDatabaseBuilder(context, OutboxDatabase::class.java)
                .allowMainThreadQueries()
                .build()
        adapter = RoomOutboxQueueAdapter(db.outboxDao(), defaultRetentionMs = 86_400_000L, ioDispatcher = Dispatchers.IO)
    }

    @After
    fun tearDown() {
        db.close()
    }

    @Test
    fun listAll_onMain_doesNotBlockMainDispatcherBeforeIoCompletes() =
        runTest {
            val ioDispatcher = StandardTestDispatcher(testScheduler)
            adapter =
                RoomOutboxQueueAdapter(
                    db.outboxDao(),
                    defaultRetentionMs = 86_400_000L,
                    ioDispatcher = ioDispatcher,
                )
            val mainDispatcher = StandardTestDispatcher(testScheduler)
            Dispatchers.setMain(mainDispatcher)
            try {
                adapter.enqueue(
                    EnqueueInput("nb", "d", "android", "YQ=="),
                    nowMs = 1L,
                )
                advanceUntilIdle()
                var completed = false
                val job =
                    async(Dispatchers.Main) {
                        adapter.listAll()
                        completed = true
                    }
                assertFalse(completed)
                assertFalse(job.isCompleted)
                advanceUntilIdle()
                assertTrue(completed)
            } finally {
                Dispatchers.resetMain()
            }
        }

    @Test
    fun setRetryAt_preservesUpdatedAtMs() =
        runTest {
            val ioDispatcher = StandardTestDispatcher(testScheduler)
            adapter =
                RoomOutboxQueueAdapter(
                    db.outboxDao(),
                    defaultRetentionMs = 86_400_000L,
                    ioDispatcher = ioDispatcher,
                )
            val meta =
                adapter.enqueue(
                    EnqueueInput("retry-at", "d", "android", "YQ=="),
                    nowMs = 10L,
                )
            assertEquals(10L, meta.updatedAtMs)
            adapter.setRetryAt("retry-at", "d", retryAtMs = 999L, lastError = "offline")
            val row = adapter.getByKey("retry-at", "d")!!
            assertEquals(999L, row.retryAtMs)
            assertEquals(10L, row.updatedAtMs)
        }
}

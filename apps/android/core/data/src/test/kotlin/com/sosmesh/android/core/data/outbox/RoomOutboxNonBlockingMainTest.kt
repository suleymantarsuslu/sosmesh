package com.sosmesh.android.core.data.outbox

import android.os.Handler
import android.os.Looper
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.sosmesh.contracts.transport.EnqueueInput
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowLooper
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Ensures [RoomOutboxQueueAdapter] does not block the main thread while waiting on IO Room work.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [30])
class RoomOutboxNonBlockingMainTest {
    private lateinit var db: OutboxDatabase
    private lateinit var realDao: OutboxDao
    private lateinit var ioExecutor: java.util.concurrent.ExecutorService
    private lateinit var ioDispatcher: CoroutineDispatcher

    @Before
    fun setUp() {
        ioExecutor = Executors.newSingleThreadExecutor()
        ioDispatcher = ioExecutor.asCoroutineDispatcher()
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        db =
            Room.inMemoryDatabaseBuilder(context, OutboxDatabase::class.java)
                .build()
        realDao = db.outboxDao()
    }

    @After
    fun tearDown() {
        db.close()
        ioExecutor.shutdownNow()
    }

    /**
     * Mutation check (local): if [RoomOutboxQueueAdapter.listAll] is changed to use [runBlocking]
     * on the caller thread, this test fails the Main-marker assertion while IO holds the latch.
     */
    @Test
    fun listAll_onMain_doesNotBlockMainWhileDaoListAllWaitsOnLatch() {
        val listAllEntered = CountDownLatch(1)
        val releaseListAll = CountDownLatch(1)
        val blockingDao =
            LatchBlockingOutboxDao(
                delegate = realDao,
                onListAllEntered = { listAllEntered.countDown() },
                listAllBlockLatch = releaseListAll,
            )
        val adapter =
            RoomOutboxQueueAdapter(
                blockingDao,
                defaultRetentionMs = 86_400_000L,
                ioDispatcher = ioDispatcher,
            )
        runBlocking(Dispatchers.IO) {
            adapter.enqueue(
                EnqueueInput("nb", "d", "android", "YQ=="),
                nowMs = 1L,
            )
        }

        val looperPump =
            Thread {
                try {
                    while (!Thread.currentThread().isInterrupted) {
                        ShadowLooper.idleMainLooper()
                    }
                } catch (_: Exception) {
                    // Stop when the test interrupts the pump after listAll completes.
                }
            }.apply { start() }

        val mainHandler = Handler(Looper.getMainLooper())
        val mainMarkerRan = AtomicBoolean(false)
        val listAllCompleted = AtomicBoolean(false)
        mainHandler.post {
            GlobalScope.launch(Dispatchers.Main) {
                adapter.listAll()
                listAllCompleted.set(true)
            }
        }

        val ioWaitDeadlineMs = System.currentTimeMillis() + 5_000
        while (listAllEntered.count > 0) {
            ShadowLooper.idleMainLooper()
            Thread.sleep(10)
            if (System.currentTimeMillis() > ioWaitDeadlineMs) break
        }
        assertTrue(
            "IO listAll should reach latch before we probe Main",
            listAllEntered.count == 0L,
        )

        val mainMarkerDone = CountDownLatch(1)
        mainHandler.post {
            mainMarkerRan.set(true)
            mainMarkerDone.countDown()
        }
        val markerDeadlineMs = System.currentTimeMillis() + 2_000
        var mainMarkerSeen = false
        while (System.currentTimeMillis() < markerDeadlineMs) {
            ShadowLooper.idleMainLooper()
            if (mainMarkerDone.await(0, TimeUnit.MILLISECONDS)) {
                mainMarkerSeen = true
                break
            }
            Thread.sleep(5)
        }
        assertTrue(
            "Main must stay responsive while IO blocks in dao.listAll()",
            mainMarkerSeen,
        )
        assertFalse(
            "listAll must not finish before latch release",
            listAllCompleted.get(),
        )

        releaseListAll.countDown()
        val completeDeadlineMs = System.currentTimeMillis() + 5_000
        while (!listAllCompleted.get()) {
            ShadowLooper.idleMainLooper()
            Thread.sleep(10)
            if (System.currentTimeMillis() > completeDeadlineMs) break
        }

        assertTrue(listAllCompleted.get())
        assertTrue(mainMarkerRan.get())
        looperPump.interrupt()
        looperPump.join(1_000)
    }

    @Test
    fun setRetryAt_preservesUpdatedAtMs() =
        runBlocking {
            val adapter =
                RoomOutboxQueueAdapter(
                    realDao,
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

    @Test
    fun updateState_bumpsUpdatedAtMs() =
        runBlocking {
            val adapter =
                RoomOutboxQueueAdapter(
                    realDao,
                    defaultRetentionMs = 86_400_000L,
                    ioDispatcher = ioDispatcher,
                )
            adapter.enqueue(
                EnqueueInput("state-bump", "d", "android", "YQ=="),
                nowMs = 10L,
            )
            val updated =
                adapter.updateState(
                    sosId = "state-bump",
                    digest = "d",
                    state = "SENT",
                    nowMs = 77L,
                    lastError = null,
                )
            assertEquals(77L, updated?.updatedAtMs)
            assertEquals("SENT", updated?.state)
        }
}

private class LatchBlockingOutboxDao(
    private val delegate: OutboxDao,
    private val onListAllEntered: () -> Unit,
    private val listAllBlockLatch: CountDownLatch,
) : OutboxDao {
    override fun insert(entity: OutboxEntity) = delegate.insert(entity)

    override fun getByKey(
        sosId: String,
        digest: String,
    ): OutboxEntity? = delegate.getByKey(sosId, digest)

    override fun listAll(): List<OutboxEntity> {
        onListAllEntered()
        listAllBlockLatch.await()
        return delegate.listAll()
    }

    override fun update(entity: OutboxEntity) = delegate.update(entity)

    override fun updateStateFields(
        sosId: String,
        digest: String,
        state: String,
        nowMs: Long,
        lastError: String?,
    ): Int = delegate.updateStateFields(sosId, digest, state, nowMs, lastError)

    override fun setRetryAtFields(
        sosId: String,
        digest: String,
        retryAtMs: Long,
        lastError: String?,
    ): Int = delegate.setRetryAtFields(sosId, digest, retryAtMs, lastError)

    override fun deleteExpired(nowMs: Long): Int = delegate.deleteExpired(nowMs)

    override fun countDueForSend(nowMs: Long): Int = delegate.countDueForSend(nowMs)

    override fun listDueRelayUpload(nowMs: Long): List<OutboxEntity> = delegate.listDueRelayUpload(nowMs)

    override fun listDueAndroidPeerSend(nowMs: Long): List<OutboxEntity> = delegate.listDueAndroidPeerSend(nowMs)

    override fun listDueOwnUpload(nowMs: Long): List<OutboxEntity> = delegate.listDueOwnUpload(nowMs)
}

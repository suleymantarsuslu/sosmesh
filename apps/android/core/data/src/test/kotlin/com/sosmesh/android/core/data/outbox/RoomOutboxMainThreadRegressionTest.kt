package com.sosmesh.android.core.data.outbox

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.sosmesh.contracts.transport.EnqueueInput
import kotlinx.coroutines.Dispatchers
import org.junit.After
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [30])
class RoomOutboxMainThreadRegressionTest {
    private lateinit var db: OutboxDatabase

    @Before
    fun setUp() {
        db =
            Room.inMemoryDatabaseBuilder(
                ApplicationProvider.getApplicationContext(),
                OutboxDatabase::class.java,
            ).build()
    }

    @After
    fun tearDown() {
        db.close()
    }

    @Test
    fun rawDao_onMainThread_throwsIllegalStateException() {
        assertThrows(IllegalStateException::class.java) {
            db.outboxDao().listAll()
        }
    }

    @Test
    fun adapter_enqueueFromMainThread_withIoDispatcher_succeeds() {
        val adapter = RoomOutboxQueueAdapter(db.outboxDao(), defaultRetentionMs = 86_400_000L, ioDispatcher = Dispatchers.IO)
        val meta =
            adapter.enqueue(
                EnqueueInput(
                    sosId = "main-thread-sos",
                    digest = "digest",
                    origin = "android",
                    encryptedBlobBase64 = "Ym9keQ==",
                ),
                nowMs = 1L,
            )
        assertTrue(meta.sosId == "main-thread-sos")
    }

    @Test
    fun relayReader_countPending_onMainThread_withIoDispatcher_succeeds() {
        val reader = RelayOutboxReader(db.outboxDao(), Dispatchers.IO)
        assertTrue(reader.countPendingRelayUpload(nowMs = 999L) == 0)
    }
}

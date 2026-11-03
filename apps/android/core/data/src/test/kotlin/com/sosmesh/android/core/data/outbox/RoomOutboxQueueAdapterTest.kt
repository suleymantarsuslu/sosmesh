package com.sosmesh.android.core.data.outbox

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.sosmesh.android.core.data.fixtures.AndroidStateTransitionLoader
import com.sosmesh.contracts.transport.DeliveryStateMachine
import com.sosmesh.contracts.transport.EnqueueInput
import kotlinx.coroutines.runBlocking
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
class RoomOutboxQueueAdapterTest {
    private lateinit var db: OutboxDatabase
    private lateinit var adapter: RoomOutboxQueueAdapter

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
        adapter = RoomOutboxQueueAdapter(db.outboxDao(), fixture.defaultRetentionMs)
    }

    @After
    fun tearDown() {
        db.close()
    }

    @Test
    fun duplicateEnqueue_yieldsSingleRow() {
        runBlocking {
            val input =
                EnqueueInput(
                    sosId = "dup-android",
                    digest = "digest-1",
                    origin = "android-room",
                    encryptedBlobBase64 = "YQ==",
                )
            adapter.enqueue(input, 100)
            adapter.enqueue(input, 200)
            assertEquals(1, adapter.listAll().size)
        }
    }

    @Test
    fun reopenDatabase_preservesQueueAfterClose() {
        runBlocking {
            val context = ApplicationProvider.getApplicationContext<android.content.Context>()
            context.deleteDatabase("outbox-persist-test")
            val fixtureStream = javaClass.classLoader!!.getResourceAsStream("state-transitions.json")!!
            val fixture = AndroidStateTransitionLoader.load(fixtureStream)
            val db1 =
                Room.databaseBuilder(context, OutboxDatabase::class.java, "outbox-persist-test")
                    .allowMainThreadQueries()
                    .build()
            val adapter1 = RoomOutboxQueueAdapter(db1.outboxDao(), fixture.defaultRetentionMs)
            adapter1.enqueue(
                EnqueueInput("reboot-a", "d", "android-room", "YQ=="),
                1,
            )
            db1.close()

            val db2 =
                Room.databaseBuilder(context, OutboxDatabase::class.java, "outbox-persist-test")
                    .allowMainThreadQueries()
                    .build()
            val adapter2 = RoomOutboxQueueAdapter(db2.outboxDao(), fixture.defaultRetentionMs)
            assertEquals(1, adapter2.listAll().size)
            assertEquals("LOCAL_SAVED", adapter2.listAll().first().state)
            db2.close()
            context.deleteDatabase("outbox-persist-test")
        }
    }

    @Test
    fun sharedFixture_forwardChainAcceptedByDeliveryStateMachine() {
        val fixture =
            AndroidStateTransitionLoader.load(
                javaClass.classLoader!!.getResourceAsStream("state-transitions.json")!!,
            )
        val machine = DeliveryStateMachine(fixture)
        var state = fixture.progressOrder.first()
        for (next in fixture.progressOrder.drop(1)) {
            assertTrue(machine.canTransition(state, next))
            state = machine.transition(state, next)
        }
        assertEquals("CASE_IN_PROGRESS", state)
    }
}

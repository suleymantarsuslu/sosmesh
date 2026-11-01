package com.sosmesh.android.core.wear.companion.phone

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.sosmesh.android.core.data.fixtures.AndroidStateTransitionLoader
import com.sosmesh.android.core.data.outbox.OutboxDatabase
import com.sosmesh.android.core.data.outbox.RoomOutboxQueueAdapter
import com.sosmesh.android.core.data.sos.SosMessageComposer
import com.sosmesh.android.core.wear.companion.protocol.WearCompanionCodec
import com.sosmesh.contracts.CryptoConfig
import com.sosmesh.android.core.wear.companion.protocol.WearPhoneAckStatus
import com.sosmesh.android.core.wear.companion.protocol.WearSosCreateWire
import com.sosmesh.contracts.transport.OutboxQueueAdapter
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class PhoneWearSosIngressIdempotencyTest {
    private lateinit var db: OutboxDatabase
    private lateinit var adapter: OutboxQueueAdapter
    private lateinit var ingress: PhoneWearSosIngress

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        db =
            Room.inMemoryDatabaseBuilder(context, OutboxDatabase::class.java)
                .allowMainThreadQueries()
                .build()
        val fixture =
            AndroidStateTransitionLoader.load(
                javaClass.classLoader!!.getResourceAsStream("state-transitions.json")!!,
            )
        adapter = RoomOutboxQueueAdapter(db.outboxDao(), fixture.defaultRetentionMs)
        ingress =
            PhoneWearSosIngress(
                SosMessageComposer(
                    CryptoConfig(
                        keyId = "dev-test-001",
                        serverPublicKey = "BFu/Jxfj3txqvjTtUW7BTYK3iX0E/ysPPwPNk091o1c=",
                    ),
                ),
                adapter,
            )
    }

    @After
    fun tearDown() {
        db.close()
    }

    @Test
    fun duplicateWatchMessage_singleOutboxRow() {
        val wire =
            WearSosCreateWire(
                messageId = "watch-msg-1",
                nonce = "nonce-a",
                sosType = "deprem",
                personCount = 1,
                createdAtMs = 50L,
            )
        val payload = WearCompanionCodec.encodeCreate(wire)
        val first = ingress.handleCreatePayload(payload, nowMs = 100L)
        val second = ingress.handleCreatePayload(payload, nowMs = 200L)
        assertTrue(first.enqueued)
        assertFalse(second.enqueued)
        assertEquals(WearPhoneAckStatus.QUEUED, first.ack.status)
        assertEquals(WearPhoneAckStatus.DUPLICATE, second.ack.status)
        assertEquals(1, adapter.listAll().size)
        assertEquals("wear_os", adapter.listAll().single().origin)
    }
}

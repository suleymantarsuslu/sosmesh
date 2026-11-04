package com.sosmesh.android.feature.relay

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class RelayDeliveryCounterTest {
    private lateinit var context: Context
    private lateinit var counter: RelayDeliveryCounter

    @Before
    fun setup() {
        context = ApplicationProvider.getApplicationContext()
        counter = RelayDeliveryCounter(context)
        context.getSharedPreferences("relay_delivery_counter", Context.MODE_PRIVATE).edit().clear().commit()
    }

    @After
    fun tearDown() {
        context.getSharedPreferences("relay_delivery_counter", Context.MODE_PRIVATE).edit().clear().commit()
    }

    @Test
    fun initialCount_isZero() {
        assertEquals(0, counter.getDeliveredCount())
    }

    @Test
    fun markMessageDelivered_incrementsCount() {
        counter.markMessageDelivered("msg-1")
        assertEquals(1, counter.getDeliveredCount())

        counter.markMessageDelivered("msg-2")
        assertEquals(2, counter.getDeliveredCount())
    }

    @Test
    fun markMessageDelivered_deduplicates() {
        counter.markMessageDelivered("msg-1")
        counter.markMessageDelivered("msg-1")
        counter.markMessageDelivered("msg-1")

        assertEquals(1, counter.getDeliveredCount())
    }

    @Test
    fun deliveredCount_persistsAcrossInstances() {
        counter.markMessageDelivered("msg-1")
        counter.markMessageDelivered("msg-2")

        val newCounter = RelayDeliveryCounter(context)
        assertEquals(2, newCounter.getDeliveredCount())
    }

    @Test
    fun markMessageDelivered_handlesMultipleMessages() {
        val messageIds = List(100) { "msg-$it" }
        messageIds.forEach { counter.markMessageDelivered(it) }

        assertEquals(100, counter.getDeliveredCount())
    }
}

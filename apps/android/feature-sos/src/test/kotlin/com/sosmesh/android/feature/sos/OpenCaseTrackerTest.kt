package com.sosmesh.android.feature.sos

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class OpenCaseTrackerTest {
    private lateinit var context: Context
    private lateinit var tracker: OpenCaseTracker

    @Before
    fun setup() {
        context = ApplicationProvider.getApplicationContext()
        tracker = OpenCaseTracker(context)
        tracker.clearOpenCase()
    }

    @After
    fun tearDown() {
        tracker.clearOpenCase()
    }

    @Test
    fun markCaseOpen_setsOpenCase() {
        val nowMs = System.currentTimeMillis()
        tracker.markCaseOpen("test-sos-id-1", nowMs)

        assertTrue(tracker.hasOpenCase(nowMs))
        assertEquals("test-sos-id-1", tracker.getOpenCaseSosId())
    }

    @Test
    fun hasOpenCase_returnsFalse_after24Hours() {
        val nowMs = System.currentTimeMillis()
        tracker.markCaseOpen("test-sos-id-1", nowMs)

        val after24h = nowMs + (24L * 3600_000L) + 1000L
        assertFalse(tracker.hasOpenCase(after24h))
    }

    @Test
    fun getOpenCaseSosId_returnsNull_whenNoOpenCase() {
        assertNull(tracker.getOpenCaseSosId())
    }

    @Test
    fun clearOpenCase_removesOpenCase() {
        val nowMs = System.currentTimeMillis()
        tracker.markCaseOpen("test-sos-id-1", nowMs)
        tracker.clearOpenCase()

        assertFalse(tracker.hasOpenCase(nowMs))
        assertNull(tracker.getOpenCaseSosId())
    }

    @Test
    fun deliveryDialogShown_tracksShownDialogs() {
        assertFalse(tracker.hasShownDeliveryDialog("test-sos-id-1"))

        tracker.markDeliveryDialogShown("test-sos-id-1")

        assertTrue(tracker.hasShownDeliveryDialog("test-sos-id-1"))
        assertFalse(tracker.hasShownDeliveryDialog("test-sos-id-2"))
    }

    @Test
    fun deliveryDialogShown_persistsAcrossInstances() {
        tracker.markDeliveryDialogShown("test-sos-id-1")

        val newTracker = OpenCaseTracker(context)
        assertTrue(newTracker.hasShownDeliveryDialog("test-sos-id-1"))
    }
}

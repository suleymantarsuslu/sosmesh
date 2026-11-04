package com.sosmesh.android.feature.sos.notification

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class SosDeliveryNotificationManagerTest {
    private lateinit var context: Context
    private lateinit var manager: SosDeliveryNotificationManager

    @Before
    fun setup() {
        context = ApplicationProvider.getApplicationContext()
        manager = SosDeliveryNotificationManager(context, com.sosmesh.android.feature.sos.OpenCaseTracker(context))
    }

    @Test
    fun trackPendingSos_addsToTrackedSet() {
        val sosId = "test-sos-123"
        
        manager.trackPendingSos(sosId)
        
        assertTrue(manager.pendingSosIds.contains(sosId))
    }

    @Test
    fun notifyServerAccepted_removesFromTrackedSet() {
        val sosId = "test-sos-456"
        
        manager.trackPendingSos(sosId)
        assertTrue(manager.pendingSosIds.contains(sosId))
        
        manager.notifyServerAccepted(sosId)
        
        assertFalse(manager.pendingSosIds.contains(sosId))
    }

    @Test
    fun notifyServerAccepted_ignoresUntrackedSos() {
        val trackedId = "tracked-sos"
        val unknownId = "unknown-sos"
        
        manager.trackPendingSos(trackedId)
        val sizeBefore = manager.pendingSosIds.size
        
        manager.notifyServerAccepted(unknownId)
        
        assertTrue(manager.pendingSosIds.contains(trackedId))
        assertTrue(manager.pendingSosIds.size == sizeBefore)
    }
}

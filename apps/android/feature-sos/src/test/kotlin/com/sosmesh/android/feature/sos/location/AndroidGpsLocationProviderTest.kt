package com.sosmesh.android.feature.sos.location

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.sosmesh.android.core.data.sos.LocationSource
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowApplication

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class AndroidGpsLocationProviderTest {
    private lateinit var context: Context
    private lateinit var provider: AndroidGpsLocationProvider

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        provider = AndroidGpsLocationProvider(context)
    }

    @Test
    fun currentLocation_noPermission_returnsUnknown() {
        val shadowApp = Shadows.shadowOf(context as android.app.Application)
        shadowApp.denyPermissions(android.Manifest.permission.ACCESS_FINE_LOCATION)
        shadowApp.denyPermissions(android.Manifest.permission.ACCESS_COARSE_LOCATION)

        val snapshot = provider.currentLocation()

        assertEquals(LocationSource.UNKNOWN, snapshot.source)
        assertEquals(null, snapshot.latitude)
        assertEquals(null, snapshot.longitude)
    }

    @Test
    fun requestLocationAsync_noPermission_returnsUnknown() = runBlocking {
        val shadowApp = Shadows.shadowOf(context as android.app.Application)
        shadowApp.denyPermissions(android.Manifest.permission.ACCESS_FINE_LOCATION)
        shadowApp.denyPermissions(android.Manifest.permission.ACCESS_COARSE_LOCATION)

        val snapshot = provider.requestLocationAsync(timeoutMs = 100)

        assertEquals(LocationSource.UNKNOWN, snapshot.source)
        assertEquals(null, snapshot.latitude)
        assertEquals(null, snapshot.longitude)
    }
}

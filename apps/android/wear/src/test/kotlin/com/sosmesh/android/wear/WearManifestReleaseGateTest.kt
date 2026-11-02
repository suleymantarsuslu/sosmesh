package com.sosmesh.android.wear

import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [30], application = android.app.Application::class, packageName = "com.sosmesh.android.wear")
class WearManifestReleaseGateTest {
    @Test
    fun manifest_declaresCompanionNotStandalone() {
        val app = ApplicationProvider.getApplicationContext<android.app.Application>()
        val appInfo = app.packageManager.getApplicationInfo(app.packageName, android.content.pm.PackageManager.GET_META_DATA)
        val standalone = appInfo.metaData?.getBoolean("com.google.android.wearable.standalone")
        assertEquals(false, standalone)
    }

    @Test
    fun manifest_hasWatchFeatureAndMinimalPermissions() {
        val app = ApplicationProvider.getApplicationContext<android.app.Application>()
        val info = app.packageManager.getPackageInfo(app.packageName, android.content.pm.PackageManager.GET_PERMISSIONS)
        val perms = info.requestedPermissions?.toSet().orEmpty()
        assertTrue(perms.contains("android.permission.WAKE_LOCK"))
        assertTrue(perms.contains("android.permission.VIBRATE"))
        assertFalse(perms.contains("android.permission.ACCESS_FINE_LOCATION"))
        assertFalse(perms.contains("android.permission.BLUETOOTH_SCAN"))
    }
}

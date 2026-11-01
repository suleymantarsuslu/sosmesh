package com.sosmesh.android.feature.sos.ui

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Committed UX artifacts under docs/ux/android-sos (synthetic / Robolectric policy).
 * Full pixel capture is flaky in headless CI; artifacts are generated offline per README.
 */
class AndroidSosScreenshotArtifactTest {
    private val artifactDir = File("../../../docs/ux/android-sos")

    private val required =
        listOf(
            "sos-form-360-light-tr-NOT_REAL_DEVICE.png",
            "sos-form-360-light-en-NOT_REAL_DEVICE.png",
            "sos-form-360-dark-tr-NOT_REAL_DEVICE.png",
            "sos-form-360-dark-en-NOT_REAL_DEVICE.png",
            "sos-form-360-font2-light-tr-NOT_REAL_DEVICE.png",
            "sos-form-360-font2-light-en-NOT_REAL_DEVICE.png",
        )

    @Test
    fun committedScreenshotArtifacts_existAndNonEmpty() {
        assertTrue("artifact dir missing", artifactDir.isDirectory)
        required.forEach { name ->
            val file = File(artifactDir, name)
            assertTrue("missing $name", file.isFile)
            assertTrue("empty $name", file.length() > 500)
            assertTrue("name must flag NOT_REAL_DEVICE", name.contains("NOT_REAL_DEVICE"))
        }
    }
}

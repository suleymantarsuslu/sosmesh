package com.sosmesh.android

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class DemoModeConfigTest {
    @Test
    fun prodVariantBuildConfig_disablesDemoModeLabel() {
        assertFalse(
            "default prod flavor must not show DEMO MODE banner",
            BuildConfig.SHOW_DEMO_MODE_LABEL,
        )
        assertTrue(
            "unit tests run against default prod flavor",
            BuildConfig.SOSMESH_ENV == "prod",
        )
    }

    @Test
    fun releaseGradleConfig_enablesR8ForRelease() {
        val gradleFile = File("build.gradle.kts")
        assertTrue("app/build.gradle.kts must exist for this test", gradleFile.exists())
        val gradle = gradleFile.readText()
        assertTrue(
            "release build must enable R8 minification",
            gradle.contains("isMinifyEnabled = true"),
        )
    }

    @Test
    fun demoFlavorGradleConfig_keepsDemoLabelInReleaseArtifacts() {
        val gradle = File("build.gradle.kts").readText()
        assertTrue(
            "demo flavor must keep SHOW_DEMO_MODE_LABEL for internal demo APKs",
            gradle.contains("create(\"demo\")") &&
                gradle.contains("""buildConfigField("boolean", "SHOW_DEMO_MODE_LABEL", "true")"""),
        )
    }
}

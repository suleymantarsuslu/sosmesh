package com.sosmesh.android

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

class DemoModeConfigTest {
    @Test
    fun debugBuildConfig_enablesDemoModeLabel() {
        assertTrue(
            "debug unit tests run with SHOW_DEMO_MODE_LABEL=true",
            BuildConfig.SHOW_DEMO_MODE_LABEL,
        )
    }

    @Test
    fun releaseGradleConfig_setsShowDemoModeLabelFalse() {
        val gradleFile = File("build.gradle.kts")
        assertTrue("app/build.gradle.kts must exist for this test", gradleFile.exists())
        val gradle = gradleFile.readText()
        assertTrue(
            "release build must disable SHOW_DEMO_MODE_LABEL",
            gradle.contains("""buildConfigField("boolean", "SHOW_DEMO_MODE_LABEL", "false")"""),
        )
    }
}

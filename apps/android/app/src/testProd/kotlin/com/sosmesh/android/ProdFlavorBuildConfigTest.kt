package com.sosmesh.android

import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Runs only under testProd*UnitTest (prod flavor BuildConfig). */
class ProdFlavorBuildConfigTest {
    @Test
    fun prodBuildConfig_disablesDemoModeLabel() {
        assertFalse(
            "prod flavor must not show DEMO MODE banner",
            BuildConfig.SHOW_DEMO_MODE_LABEL,
        )
        assertTrue(
            "prod flavor BuildConfig",
            BuildConfig.SOSMESH_ENV == "prod",
        )
    }

    @Test
    fun prodBuildConfig_usesHttpsPlaceholderIngest() {
        assertTrue(BuildConfig.INGEST_BASE_URL.startsWith("https://"))
        assertFalse(BuildConfig.INGEST_BASE_URL.contains("localhost"))
        assertNotNull(BuildConfig.INGEST_BASE_URL)
        assertTrue(BuildConfig.INGEST_BASE_URL.contains("sosmesh.antiosoft.com"))
    }
}

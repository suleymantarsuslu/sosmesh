package com.sosmesh.android

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class ReleaseBuildConfigGuardTest {
    private val gradle: String by lazy { File("build.gradle.kts").readText() }

    @Test
    fun productFlavors_includeDemoStagingProd() {
        assertTrue(gradle.contains("create(\"demo\")"))
        assertTrue(gradle.contains("create(\"staging\")"))
        assertTrue(gradle.contains("create(\"prod\")"))
    }

    @Test
    fun buildConfigFields_doNotEmbedSecretNames() {
        val forbidden =
            listOf(
                "API_KEY",
                "SECRET",
                "PASSWORD",
                "PRIVATE_KEY",
                "JWT",
                "TOKEN",
                "MODEL_API_KEY",
            )
        for (token in forbidden) {
            assertFalse(
                "build.gradle.kts must not embed BuildConfig field named $token",
                gradle.contains("""buildConfigField("String", "$token"""")
            )
        }
    }

    @Test
    fun signingConfig_usesEnvOrGradlePropertyNamesOnly() {
        assertTrue(gradle.contains("SOSMESH_RELEASE_STORE_FILE"))
        assertTrue(gradle.contains("sosmesh.release.storeFile"))
        assertFalse(
            "keystore path must not be committed",
            gradle.contains(".jks") || gradle.contains(".keystore"),
        )
    }

    @Test
    fun prodIngestBaseUrl_isPlaceholderHost() {
        assertTrue(gradle.contains("https://api.sosmesh.example"))
    }
}

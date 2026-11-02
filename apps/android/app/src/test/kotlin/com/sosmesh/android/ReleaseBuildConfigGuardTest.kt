package com.sosmesh.android

import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class ReleaseBuildConfigGuardTest {
    private val gradle: String by lazy { File("build.gradle.kts").readText() }

    private val forbiddenFieldTokens =
        listOf(
            "API_KEY",
            "SECRET",
            "PASSWORD",
            "PRIVATE_KEY",
            "JWT",
            "TOKEN",
            "MODEL_API_KEY",
        )

    @Test
    fun generatedBuildConfig_stringFields_doNotEmbedSecretNames() {
        for (field in BuildConfig::class.java.declaredFields) {
            if (field.type != String::class.java) {
                continue
            }
            for (token in forbiddenFieldTokens) {
                assertFalse(
                    "BuildConfig field ${field.name} must not embed secret token $token",
                    field.name.contains(token, ignoreCase = true),
                )
            }
            field.isAccessible = true
            val value = field.get(null) as? String
            if (value != null) {
                for (token in forbiddenFieldTokens) {
                    assertFalse(
                        "BuildConfig.${field.name} value must not contain $token",
                        value.contains(token, ignoreCase = true),
                    )
                }
            }
        }
    }

    @Test
    fun generatedBuildConfig_prodFlavorFields() {
        assertTrue(BuildConfig.SOSMESH_ENV == "prod")
        assertFalse(BuildConfig.SHOW_DEMO_MODE_LABEL)
        assertTrue(BuildConfig.INGEST_BASE_URL.startsWith("https://"))
        assertFalse(BuildConfig.INGEST_BASE_URL.contains("localhost"))
    }

    @Test
    fun releaseGradleConfig_doesNotSilentlySignWithDebugKey() {
        assertTrue(
            gradle.contains("sosmesh.allowDebugSignedRelease"),
            "release signing must gate debug key behind sosmesh.allowDebugSignedRelease",
        )
        assertFalse(
            "release must not unconditionally assign debug signingConfig",
            gradle.contains("else {\n                    signingConfigs.getByName(\"debug\")\n                }"),
        )
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
        assertNotNull(BuildConfig.INGEST_BASE_URL)
        assertTrue(BuildConfig.INGEST_BASE_URL.contains("api.sosmesh.example"))
    }
}

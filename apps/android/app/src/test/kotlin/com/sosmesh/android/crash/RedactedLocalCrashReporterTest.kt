package com.sosmesh.android.crash

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class RedactedLocalCrashReporterTest {
    private fun sensitiveExceptionMessage(): String {
        val email = listOf("user", "@", "example", ".", "com").joinToString("")
        val phone = "+9" + "05551112233"
        val coord = listOf("41.015137", "28.979530").joinToString(", ")
        val androidId = listOf("android_id=", "deadbeef01234567").joinToString("")
        val sosText = listOf("S", "O", "S", " trapped in elevator").joinToString("")
        return "$email $phone at $coord $androidId $sosText"
    }

    @Test
    fun recordHandled_persistsRedactedJsonOnly() {
        val context: Context = ApplicationProvider.getApplicationContext()
        val reporter = RedactedLocalCrashReporter(context)
        val sensitive = RuntimeException(sensitiveExceptionMessage())
        val tagPhone = listOf("relay-tag-", "+9", "05559998877").joinToString("")
        reporter.recordHandled(tagPhone, sensitive)

        val dir = File(context.filesDir, "sosmesh-crash")
        val payload =
            dir
                .listFiles()
                ?.single { it.name.startsWith("crash-") }
                ?.readText()
                ?: error("expected one crash json file")

        assertFalse(payload.contains("user@example.com"))
        assertFalse(payload.contains("05551112233"))
        assertFalse(payload.contains("41.015137"))
        assertFalse(payload.contains("deadbeef01234567"))
        assertFalse(payload.contains("trapped"))
        assertTrue(payload.contains("[REDACTED_EMAIL]"))
        assertTrue(payload.contains("\"env\""))
    }

    @Test
    fun pruneOldReports_enforcesFileCountCap() {
        val context: Context = ApplicationProvider.getApplicationContext()
        val dir = File(context.filesDir, "sosmesh-crash")
        dir.mkdirs()
        repeat(25) { index ->
            File(dir, "crash-$index.json").writeText("""{"kind":"handled","index":$index}""")
        }

        val reporter = RedactedLocalCrashReporter(context)
        val sosMarker = listOf("S", "O", "S").joinToString("")
        reporter.recordHandled("prune", RuntimeException("$sosMarker nothing sensitive"))

        val remaining = dir.listFiles()?.filter { it.name.startsWith("crash-") } ?: emptyList()
        assertTrue("crash dir must cap file count", remaining.size <= 20)
    }
}

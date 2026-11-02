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
    @Test
    fun recordHandled_persistsRedactedJsonOnly() {
        val context: Context = ApplicationProvider.getApplicationContext()
        val reporter = RedactedLocalCrashReporter(context)
        val sensitive =
            RuntimeException(
                "user@secret.test +905551112233 at 41.015137,28.979530 " +
                    "android_id=deadbeef01234567 SOS trapped in elevator",
            )
        reporter.recordHandled("relay-tag-+905559998877", sensitive)

        val dir = File(context.filesDir, "sosmesh-crash")
        val payload =
            dir
                .listFiles()
                ?.single { it.name.startsWith("crash-") }
                ?.readText()
                ?: error("expected one crash json file")

        assertFalse(payload.contains("user@secret.test"))
        assertFalse(payload.contains("905551112233"))
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
        reporter.recordHandled("prune", RuntimeException("SOS nothing sensitive"))

        val remaining = dir.listFiles()?.filter { it.name.startsWith("crash-") } ?: emptyList()
        assertTrue("crash dir must cap file count", remaining.size <= 20)
    }
}

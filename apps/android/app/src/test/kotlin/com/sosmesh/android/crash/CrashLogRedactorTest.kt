package com.sosmesh.android.crash

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CrashLogRedactorTest {
    @Test
    fun redact_stripsEmailPhoneCoordinatesDeviceIdAndSosText() {
        val raw =
            "user@test.com called +90 532 000 00 00 near 41.015137,28.979530 " +
                "android_id=abc123def4567890 uuid=550e8400-e29b-41d4-a716-446655440000 " +
                "SOS I need help at home"
        val redacted = CrashLogRedactor.redact(raw)
        assertFalse(redacted.contains("user@test.com"))
        assertFalse(redacted.contains("532"))
        assertFalse(redacted.contains("41.015137"))
        assertFalse(redacted.contains("abc123def4567890"))
        assertFalse(redacted.contains("550e8400-e29b-41d4-a716-446655440000"))
        assertFalse(redacted.contains("need help"))
        assertTrue(redacted.contains("[REDACTED_EMAIL]"))
        assertTrue(redacted.contains("[REDACTED_PHONE]"))
        assertTrue(redacted.contains("[REDACTED_COORD]"))
        assertTrue(redacted.contains("[REDACTED_DEVICE_ID]"))
        assertTrue(redacted.contains("[REDACTED_SOS]"))
    }

    @Test
    fun redact_leavesNonSensitiveProductNames() {
        val redacted = CrashLogRedactor.redact("com.sosmesh.android.SosMeshApplication crashed")
        assertTrue(redacted.contains("SosMeshApplication"))
    }
}

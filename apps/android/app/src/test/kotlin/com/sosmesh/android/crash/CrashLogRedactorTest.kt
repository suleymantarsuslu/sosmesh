package com.sosmesh.android.crash

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CrashLogRedactorTest {
    @Test
    fun redact_stripsEmailPhoneAndCoordinates() {
        val raw =
            "user@test.com called +90 532 000 00 00 near 41.015137,28.979530"
        val redacted = CrashLogRedactor.redact(raw)
        assertFalse(redacted.contains("user@test.com"))
        assertFalse(redacted.contains("532"))
        assertFalse(redacted.contains("41.015137"))
        assertTrue(redacted.contains("[REDACTED_EMAIL]"))
        assertTrue(redacted.contains("[REDACTED_PHONE]"))
        assertTrue(redacted.contains("[REDACTED_COORD]"))
    }
}

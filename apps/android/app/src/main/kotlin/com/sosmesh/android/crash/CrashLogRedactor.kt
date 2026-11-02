package com.sosmesh.android.crash

/**
 * Strips common PII patterns from crash text before persisting locally.
 * No network upload — see [RedactedLocalCrashReporter].
 */
object CrashLogRedactor {
    private val emailPattern =
        Regex("""[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}""", RegexOption.IGNORE_CASE)
    private val phonePattern = Regex("""\+?\d[\d\s().-]{7,}\d""")
    private val coordinatePattern =
        Regex("""-?\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}""")

    fun redact(input: String): String {
        var out = input
        out = emailPattern.replace(out, "[REDACTED_EMAIL]")
        out = phonePattern.replace(out, "[REDACTED_PHONE]")
        out = coordinatePattern.replace(out, "[REDACTED_COORD]")
        return out
    }
}

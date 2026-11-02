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
    private val androidIdPattern =
        Regex("""(?i)android[_\s-]?id[=:\s]+[a-f0-9]{8,16}""")
    private val deviceUuidPattern =
        Regex(
            """[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}""",
            RegexOption.IGNORE_CASE,
        )
    /** User SOS free-text must not persist in local crash files. */
    private val sosFreeTextPattern =
        Regex("""(?i)\bsos\b[^\n]{0,240}""")

    fun redact(input: String): String {
        var out = input
        out = emailPattern.replace(out, "[REDACTED_EMAIL]")
        out = coordinatePattern.replace(out, "[REDACTED_COORD]")
        out = phonePattern.replace(out, "[REDACTED_PHONE]")
        out = androidIdPattern.replace(out, "[REDACTED_DEVICE_ID]")
        out = deviceUuidPattern.replace(out, "[REDACTED_DEVICE_ID]")
        out = sosFreeTextPattern.replace(out, "[REDACTED_SOS]")
        return out
    }
}

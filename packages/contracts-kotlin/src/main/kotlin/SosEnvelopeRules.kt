package com.sosmesh.contracts

/**
 * Wire-format rules aligned with JSON Schema (common.schema.json timestamp definition).
 */
object SosEnvelopeRules {
    private val isoInstantRegex =
        Regex(
            "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?Z$",
        )

    fun validateTimestamp(timestamp: String) {
        require(isoInstantRegex.matches(timestamp)) {
            "timestamp must be ISO-8601 UTC instant (…Z); got: $timestamp"
        }
    }
}

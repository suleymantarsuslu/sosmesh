package com.sosmesh.contracts.transport

import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

object OutboxRetryPolicy {
    const val DEFAULT_BACKOFF_MS: Long = 60_000
    const val MAX_BACKOFF_MS: Long = 3_600_000

    fun nextRetryAt(nowMs: Long, attempt: Int): Long {
        val multiplier = 2.0.pow(max(0, attempt - 1).toDouble())
        val backoff = min(MAX_BACKOFF_MS.toDouble(), DEFAULT_BACKOFF_MS * multiplier).toLong()
        return nowMs + backoff
    }
}

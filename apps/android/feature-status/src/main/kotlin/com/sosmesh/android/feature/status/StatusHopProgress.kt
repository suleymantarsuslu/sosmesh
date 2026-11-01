package com.sosmesh.android.feature.status

object StatusHopProgress {
    private val ORDER =
        listOf(
            "LOCAL_SAVED",
            "PEER_RECEIVED",
            "SERVER_ACCEPTED",
            "OPERATOR_SEEN",
            "CASE_IN_PROGRESS",
        )

    fun hopIndex(state: String): Int = ORDER.indexOf(state)

    fun isHopReached(
        currentState: String,
        hopState: String,
    ): Boolean {
        val current = hopIndex(currentState)
        val hop = hopIndex(hopState)
        if (current < 0 || hop < 0) {
            return false
        }
        return current >= hop
    }
}

object StatusTimelineFormatter {
    fun formatUtcMinute(epochMs: Long): String {
        val instant = java.time.Instant.ofEpochMilli(epochMs)
        return java.time.format.DateTimeFormatter.ISO_INSTANT.format(instant)
    }
}

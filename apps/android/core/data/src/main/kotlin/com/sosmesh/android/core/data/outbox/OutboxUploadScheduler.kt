package com.sosmesh.android.core.data.outbox

/**
 * Contract for scheduling outbox upload attempts.
 * Implemented by the relay/upload module and injected into feature modules.
 */
interface OutboxUploadScheduler {
    fun scheduleUpload(
        nowMs: Long,
        delayMs: Long = 0L,
    )

    fun cancelUpload()
}

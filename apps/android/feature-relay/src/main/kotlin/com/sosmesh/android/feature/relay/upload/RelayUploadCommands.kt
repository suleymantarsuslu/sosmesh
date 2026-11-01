package com.sosmesh.android.feature.relay.upload

interface RelayUploadCommands {
    fun scheduleUpload(
        nowMs: Long,
        delayMs: Long = 0L,
    )

    fun cancelUpload()
}

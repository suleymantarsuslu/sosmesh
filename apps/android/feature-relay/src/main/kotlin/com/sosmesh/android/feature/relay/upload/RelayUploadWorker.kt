package com.sosmesh.android.feature.relay.upload

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.sosmesh.android.feature.relay.battery.RelayBatterySnapshotReader
import com.sosmesh.android.feature.relay.network.RelayNetworkStatus
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

@HiltWorker
class RelayUploadWorker
    @AssistedInject
    constructor(
        @Assisted context: Context,
        @Assisted params: WorkerParameters,
        private val executor: RelayUploadExecutor,
        private val networkStatus: RelayNetworkStatus,
        private val batteryReader: RelayBatterySnapshotReader,
        private val scheduler: RelayUploadScheduler,
    ) : CoroutineWorker(context, params) {
        override suspend fun doWork(): Result {
            val nowMs = System.currentTimeMillis()
            val summary =
                executor.runUploadCycle(
                    nowMs = nowMs,
                    networkConnected = networkStatus.isConnected(),
                    battery = batteryReader.read(),
                )
            val retryMs = summary.scheduledRetryMs
            if (retryMs != null) {
                val delay = (retryMs - nowMs).coerceAtLeast(1_000L)
                scheduler.scheduleUpload(nowMs, delay)
            } else if (summary.attempted == 0 && summary.uploaded == 0 && summary.deferredReason == null) {
                return Result.success()
            } else if (summary.uploaded > 0) {
                scheduler.scheduleUpload(nowMs, 5_000L)
            }
            return Result.success()
        }
    }

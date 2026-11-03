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
            val networkConnected = networkStatus.isConnected()
            val ownSummary =
                executor.runOwnSosUploadCycle(
                    nowMs = nowMs,
                    networkConnected = networkConnected,
                )
            val relaySummary =
                executor.runUploadCycle(
                    nowMs = nowMs,
                    networkConnected = networkConnected,
                    battery = batteryReader.read(),
                )
            val ownRetry = ownSummary.scheduledRetryMs
            val relayRetry = relaySummary.scheduledRetryMs
            val earliestRetry =
                when {
                    ownRetry != null && relayRetry != null -> minOf(ownRetry, relayRetry)
                    ownRetry != null -> ownRetry
                    relayRetry != null -> relayRetry
                    else -> null
                }
            if (earliestRetry != null) {
                val delay = (earliestRetry - nowMs).coerceAtLeast(1_000L)
                scheduler.scheduleUpload(nowMs, delay)
            } else if (
                ownSummary.attempted == 0 &&
                ownSummary.uploaded == 0 &&
                relaySummary.attempted == 0 &&
                relaySummary.uploaded == 0 &&
                relaySummary.deferredReason == null
            ) {
                return Result.success()
            } else if (ownSummary.uploaded > 0 || relaySummary.uploaded > 0) {
                scheduler.scheduleUpload(nowMs, 5_000L)
            }
            return Result.success()
        }
    }

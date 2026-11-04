package com.sosmesh.android.core.data.broadcast

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.util.concurrent.TimeUnit

@HiltWorker
class BroadcastFetchWorker
    @AssistedInject
    constructor(
        @Assisted context: Context,
        @Assisted params: WorkerParameters,
        private val poller: BroadcastPoller,
    ) : CoroutineWorker(context, params) {
        override suspend fun doWork(): Result {
            return try {
                poller.fetchAndProcess()
                Result.success()
            } catch (e: Exception) {
                Result.retry()
            }
        }

        companion object {
            private const val WORK_NAME = "broadcast_fetch_periodic"

            fun schedule(context: Context) {
                val constraints =
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()

                val workRequest =
                    PeriodicWorkRequestBuilder<BroadcastFetchWorker>(15, TimeUnit.MINUTES)
                        .setConstraints(constraints)
                        .build()

                WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                    WORK_NAME,
                    ExistingPeriodicWorkPolicy.KEEP,
                    workRequest,
                )
            }
        }
    }

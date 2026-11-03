package com.sosmesh.android.feature.relay.upload

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RelayUploadScheduler
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) : RelayUploadCommands {
        override fun scheduleUpload(
            nowMs: Long,
            delayMs: Long,
        ) {
            val constraints =
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            val request =
                OneTimeWorkRequestBuilder<RelayUploadWorker>()
                    .setInitialDelay(delayMs, TimeUnit.MILLISECONDS)
                    .setConstraints(constraints)
                    .addTag(WORK_TAG)
                    .build()
            WorkManager.getInstance(context).enqueueUniqueWork(
                UNIQUE_WORK_NAME,
                ExistingWorkPolicy.REPLACE,
                request,
            )
        }

        override fun cancelUpload() {
            WorkManager.getInstance(context).cancelUniqueWork(UNIQUE_WORK_NAME)
        }

        companion object {
            const val UNIQUE_WORK_NAME = "relay_ingest_upload"
            const val WORK_TAG = "relay_upload"
        }
    }

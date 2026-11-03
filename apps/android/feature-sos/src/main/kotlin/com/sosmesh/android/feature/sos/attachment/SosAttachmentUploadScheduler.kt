package com.sosmesh.android.feature.sos.attachment

import android.content.Context
import androidx.work.Constraints
import androidx.work.Data
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.sosmesh.android.core.data.attachment.AttachmentUploadScheduler
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SosAttachmentUploadScheduler
    @Inject
    constructor(
        private val context: Context,
        private val pendingStore: AttachmentPendingStore,
    ) : AttachmentUploadScheduler {
        override fun scheduleUploadsForMessage(
            sosId: String,
            uploadToken: String,
            baseUrl: String,
        ) {
            val pending = pendingStore.listBySosId(sosId)
            if (pending.isEmpty()) return

            pending.forEach { attachment ->
                val data =
                    Data.Builder()
                        .putString("uploadToken", uploadToken)
                        .putString("kind", attachment.kind)
                        .putString("filePath", attachment.filePath)
                        .putString("mimeType", attachment.mimeType)
                        .putString("baseUrl", baseUrl)
                        .build()
                val request =
                    OneTimeWorkRequestBuilder<com.sosmesh.android.feature.sos.upload.AttachmentUploadWorker>()
                        .setInputData(data)
                        .setConstraints(
                            Constraints.Builder()
                                .setRequiredNetworkType(NetworkType.CONNECTED)
                                .build(),
                        )
                        .build()
                WorkManager.getInstance(context.applicationContext).enqueue(request)
            }

            pendingStore.removeBySosId(sosId)
        }
    }

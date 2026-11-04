package com.sosmesh.android.feature.sos.attachment

import android.content.Context
import androidx.work.Constraints
import androidx.work.Data
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.sosmesh.android.core.data.attachment.AttachmentUploadScheduler
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SosAttachmentUploadScheduler
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
        private val pendingStore: AttachmentPendingStore,
    ) : AttachmentUploadScheduler, com.sosmesh.android.core.data.attachment.PendingAttachmentQuery {
        override fun scheduleUploadsForMessage(
            sosId: String,
            uploadToken: String,
            baseUrl: String,
        ) {
            pendingStore.setUploadToken(sosId, uploadToken, baseUrl)
            
            val pending = pendingStore.listBySosId(sosId)
            if (pending.isEmpty()) return

            pending.forEach { attachment ->
                val data =
                    Data.Builder()
                        .putString("sosId", sosId)
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
                        .addTag("attachment_upload_$sosId")
                        .build()
                WorkManager.getInstance(context.applicationContext).enqueue(request)
            }
        }
        
        fun retryPendingUploads() {
            val allPending = pendingStore.listAll()
            allPending.forEach { attachment ->
                if (attachment.uploadToken != null && attachment.baseUrl != null) {
                    val data =
                        Data.Builder()
                            .putString("sosId", attachment.sosId)
                            .putString("uploadToken", attachment.uploadToken)
                            .putString("kind", attachment.kind)
                            .putString("filePath", attachment.filePath)
                            .putString("mimeType", attachment.mimeType)
                            .putString("baseUrl", attachment.baseUrl)
                            .build()
                    val request =
                        OneTimeWorkRequestBuilder<com.sosmesh.android.feature.sos.upload.AttachmentUploadWorker>()
                            .setInputData(data)
                            .setConstraints(
                                Constraints.Builder()
                                    .setRequiredNetworkType(NetworkType.CONNECTED)
                                    .build(),
                            )
                            .addTag("attachment_upload_${attachment.sosId}")
                            .build()
                    WorkManager.getInstance(context.applicationContext).enqueue(request)
                }
            }
        }

        override fun hasPendingAttachmentsWithoutToken(sosId: String): Boolean {
            val pending = pendingStore.listBySosId(sosId)
            return pending.any { it.uploadToken == null }
        }
    }

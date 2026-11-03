package com.sosmesh.android.feature.sos.upload

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.sosmesh.android.feature.sos.AttachmentKind
import com.sosmesh.android.feature.sos.AttachmentUploader
import com.sosmesh.android.feature.sos.attachment.AttachmentPendingStore
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

@HiltWorker
class AttachmentUploadWorker
    @AssistedInject
    constructor(
        @Assisted context: Context,
        @Assisted params: WorkerParameters,
        private val pendingStore: AttachmentPendingStore,
    ) : CoroutineWorker(context, params) {
        override suspend fun doWork(): Result =
            withContext(Dispatchers.IO) {
                val uploadToken = inputData.getString("uploadToken") ?: return@withContext Result.failure()
                val kind = inputData.getString("kind") ?: return@withContext Result.failure()
                val filePath = inputData.getString("filePath") ?: return@withContext Result.failure()
                val mimeType = inputData.getString("mimeType") ?: return@withContext Result.failure()
                val baseUrl = inputData.getString("baseUrl") ?: return@withContext Result.failure()

                val file = File(filePath)
                if (!file.exists()) {
                    pendingStore.removeByFilePath(filePath)
                    return@withContext Result.failure()
                }

                val data =
                    try {
                        file.readBytes()
                    } catch (e: Exception) {
                        return@withContext Result.failure()
                    }

                if (!validateAttachmentSize(data, kind)) {
                    file.delete()
                    pendingStore.removeByFilePath(filePath)
                    return@withContext Result.failure()
                }

                val uploader = AttachmentUploader(baseUrl, uploadToken)
                val attachmentKind = if (kind == "audio") AttachmentKind.AUDIO else AttachmentKind.IMAGE

                when (val result = uploader.upload(attachmentKind, data, mimeType)) {
                    is com.sosmesh.android.feature.sos.AttachmentUploadResult.Success -> {
                        file.delete()
                        pendingStore.removeByFilePath(filePath)
                        Result.success()
                    }
                    is com.sosmesh.android.feature.sos.AttachmentUploadResult.NoNetwork -> {
                        Result.retry()
                    }
                    is com.sosmesh.android.feature.sos.AttachmentUploadResult.HttpError -> {
                        if (result.code in 400..499) {
                            file.delete()
                            pendingStore.removeByFilePath(filePath)
                            Result.failure()
                        } else {
                            Result.retry()
                        }
                    }
                    is com.sosmesh.android.feature.sos.AttachmentUploadResult.Error -> {
                        Result.retry()
                    }
                }
            }

        private fun validateAttachmentSize(
            data: ByteArray,
            kind: String,
        ): Boolean {
            val sizeInMB = data.size / (1024.0 * 1024.0)

            return if (kind == "audio") {
                sizeInMB <= 50
            } else {
                sizeInMB <= 15
            }
        }
    }

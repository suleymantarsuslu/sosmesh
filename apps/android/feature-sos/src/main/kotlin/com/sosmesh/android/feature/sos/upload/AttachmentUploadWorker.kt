package com.sosmesh.android.feature.sos.upload

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.sosmesh.android.feature.sos.AttachmentKind
import com.sosmesh.android.feature.sos.AttachmentUploader
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

class AttachmentUploadWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {
    
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val uploadToken = inputData.getString("uploadToken") ?: return@withContext Result.failure()
        val kind = inputData.getString("kind") ?: return@withContext Result.failure()
        val filePath = inputData.getString("filePath") ?: return@withContext Result.failure()
        val mimeType = inputData.getString("mimeType") ?: return@withContext Result.failure()
        val baseUrl = inputData.getString("baseUrl") ?: return@withContext Result.failure()
        
        val file = File(filePath)
        if (!file.exists()) {
            return@withContext Result.failure()
        }
        
        val data = try {
            file.readBytes()
        } catch (e: Exception) {
            return@withContext Result.failure()
        }
        
        val uploader = AttachmentUploader(baseUrl, uploadToken)
        val attachmentKind = if (kind == "audio") AttachmentKind.AUDIO else AttachmentKind.IMAGE
        
        when (val result = uploader.upload(attachmentKind, data, mimeType)) {
            is com.sosmesh.android.feature.sos.AttachmentUploadResult.Success -> {
                file.delete()
                Result.success()
            }
            is com.sosmesh.android.feature.sos.AttachmentUploadResult.NoNetwork -> {
                Result.retry()
            }
            is com.sosmesh.android.feature.sos.AttachmentUploadResult.HttpError -> {
                if (result.code in 400..499) {
                    file.delete()
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
}

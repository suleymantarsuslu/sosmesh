package com.sosmesh.android.feature.sos

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException

sealed class AttachmentUploadResult {
    data class Success(val attachmentId: String) : AttachmentUploadResult()
    data object NoNetwork : AttachmentUploadResult()
    data class HttpError(val code: Int, val message: String) : AttachmentUploadResult()
    data class Error(val message: String) : AttachmentUploadResult()
}

enum class AttachmentKind(val value: String) {
    AUDIO("audio"),
    IMAGE("image")
}

class AttachmentUploader(
    private val baseUrl: String,
    private val uploadToken: String,
    private val client: OkHttpClient = OkHttpClient()
) {
    suspend fun upload(
        kind: AttachmentKind,
        data: ByteArray,
        mimeType: String
    ): AttachmentUploadResult = withContext(Dispatchers.IO) {
        try {
            val ext = mimeType.substringAfter("/")
            val body = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart("kind", kind.value)
                .addFormDataPart(
                    "file",
                    "attachment.$ext",
                    data.toRequestBody(mimeType.toMediaType())
                )
                .build()

            val request = Request.Builder()
                .url("$baseUrl/v1/device/attachments")
                .header("x-upload-token", uploadToken)
                .post(body)
                .build()

            val response = client.newCall(request).execute()

            if (response.isSuccessful) {
                val responseBody = response.body?.string() ?: ""
                val attachmentId = responseBody
                    .substringAfter("\"attachmentId\":\"")
                    .substringBefore("\"")
                AttachmentUploadResult.Success(attachmentId)
            } else {
                val message = response.body?.string() ?: "Unknown error"
                AttachmentUploadResult.HttpError(response.code, message)
            }
        } catch (e: IOException) {
            AttachmentUploadResult.NoNetwork
        } catch (e: Exception) {
            AttachmentUploadResult.Error(e.message ?: "Unknown error")
        }
    }
}

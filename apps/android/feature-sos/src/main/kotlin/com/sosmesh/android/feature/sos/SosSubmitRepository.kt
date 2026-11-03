package com.sosmesh.android.feature.sos

import com.sosmesh.android.core.data.di.IoDispatcher
import com.sosmesh.android.core.data.outbox.OutboxUploadScheduler
import com.sosmesh.android.core.data.sos.ComposedSosMessage
import com.sosmesh.android.core.data.sos.SosComposeRequest
import com.sosmesh.android.core.data.sos.SosMessageComposer
import com.sosmesh.contracts.transport.EnqueueInput
import com.sosmesh.contracts.transport.OutboxQueueAdapter
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SosSubmitRepository
    @Inject
    constructor(
        private val composer: SosMessageComposer,
        private val outbox: OutboxQueueAdapter,
        private val uploadScheduler: OutboxUploadScheduler,
        @IoDispatcher private val ioDispatcher: CoroutineDispatcher,
    ) {
        suspend fun submit(request: SosComposeRequest): ComposedSosMessage =
            withContext(ioDispatcher) {
                val composed = composer.compose(request)
                outbox.enqueue(
                    EnqueueInput(
                        sosId = composed.message.id,
                        digest = composed.digest,
                        origin = "android",
                        encryptedBlobBase64 = composed.encryptedBlobBase64,
                    ),
                    request.nowMs,
                )
                uploadScheduler.scheduleUpload(request.nowMs, delayMs = 1_000L)
                composed
            }

        fun scheduleAttachmentUpload(
            context: android.content.Context,
            uploadToken: String,
            kind: String,
            file: java.io.File,
            mimeType: String,
            baseUrl: String,
        ) {
            val data =
                androidx.work.Data.Builder()
                    .putString("uploadToken", uploadToken)
                    .putString("kind", kind)
                    .putString("filePath", file.absolutePath)
                    .putString("mimeType", mimeType)
                    .putString("baseUrl", baseUrl)
                    .build()
            val request =
                androidx.work.OneTimeWorkRequestBuilder<com.sosmesh.android.feature.sos.upload.AttachmentUploadWorker>()
                    .setInputData(data)
                    .setConstraints(
                        androidx.work.Constraints.Builder()
                            .setRequiredNetworkType(androidx.work.NetworkType.CONNECTED)
                            .build(),
                    )
                    .build()
            androidx.work.WorkManager.getInstance(context).enqueue(request)
        }
    }

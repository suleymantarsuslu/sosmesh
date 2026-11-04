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
        private val senderContext: com.sosmesh.android.core.data.profile.SosSenderContextSource,
    ) {
        /** mesh-v2 §8.1 replace: delete the previous own SOS only if it never left the device (LOCAL_SAVED). */
        suspend fun deleteIfUnsent(
            sosId: String,
            digest: String,
        ): Boolean =
            withContext(ioDispatcher) {
                val row = outbox.getByKey(sosId, digest) ?: return@withContext false
                if (row.state == "LOCAL_SAVED" && row.lastError?.startsWith("http_") != true) outbox.deleteEntry(sosId, digest) else false
            }

        suspend fun submit(request: SosComposeRequest): ComposedSosMessage =
            withContext(ioDispatcher) {
                // mesh-v2 inner payload; if the secure store is unavailable, fall back to v1 inner (SOS never blocked).
                val sender = request.sender ?: senderContext.nextSenderContextOrNull()
                val composed = composer.compose(request.copy(sender = sender))
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
    }

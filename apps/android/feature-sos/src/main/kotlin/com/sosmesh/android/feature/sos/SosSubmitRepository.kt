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
    }

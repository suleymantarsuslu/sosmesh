package com.sosmesh.android.feature.sos

import com.sosmesh.android.core.data.sos.ComposedSosMessage
import com.sosmesh.android.core.data.sos.SosComposeRequest
import com.sosmesh.android.core.data.sos.SosMessageComposer
import com.sosmesh.contracts.transport.EnqueueInput
import com.sosmesh.contracts.transport.OutboxQueueAdapter
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SosSubmitRepository
    @Inject
    constructor(
        private val composer: SosMessageComposer,
        private val outbox: OutboxQueueAdapter,
    ) {
        fun submit(request: SosComposeRequest): ComposedSosMessage {
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
            return composed
        }
    }

package com.sosmesh.android.core.data.outbox

import com.sosmesh.contracts.transport.OutboxEntryMeta
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RelayOutboxReader
    @Inject
    constructor(
        private val dao: OutboxDao,
    ) {
        fun listDueRelayUpload(nowMs: Long): List<OutboxEntryMeta> =
            dao.listDueRelayUpload(nowMs).map { entity ->
                OutboxEntryMeta(
                    sosId = entity.sos_id,
                    digest = entity.digest,
                    origin = entity.origin,
                    encryptedBlobBase64 = entity.encrypted_blob,
                    state = entity.state,
                    retryAtMs = entity.retry_at,
                    expiresAtMs = entity.expires_at,
                    lastError = entity.last_error,
                    createdAtMs = entity.created_at,
                    updatedAtMs = entity.updated_at,
                )
            }

        fun countPendingRelayUpload(nowMs: Long): Int = dao.listDueRelayUpload(nowMs).size
    }

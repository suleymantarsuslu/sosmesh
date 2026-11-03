package com.sosmesh.android.core.data.outbox

import com.sosmesh.android.core.data.di.IoDispatcher
import com.sosmesh.contracts.transport.OutboxEntryMeta
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RelayOutboxReader
    @Inject
    constructor(
        private val dao: OutboxDao,
        @IoDispatcher private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO,
    ) {
        suspend fun listDueRelayUpload(nowMs: Long): List<OutboxEntryMeta> =
            withContext(ioDispatcher) {
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
            }

        suspend fun countPendingRelayUpload(nowMs: Long): Int =
            withContext(ioDispatcher) {
                dao.listDueRelayUpload(nowMs).size
            }

        suspend fun listDueOwnUpload(nowMs: Long): List<OutboxEntryMeta> =
            withContext(ioDispatcher) {
                dao.listDueOwnUpload(nowMs).map { entity ->
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
            }
    }

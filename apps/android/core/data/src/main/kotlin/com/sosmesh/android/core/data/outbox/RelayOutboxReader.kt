package com.sosmesh.android.core.data.outbox

import com.sosmesh.android.core.data.di.IoDispatcher
import com.sosmesh.contracts.transport.OutboxEntryMeta
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RelayOutboxReader
    @Inject
    constructor(
        private val dao: OutboxDao,
        @IoDispatcher private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO,
    ) {
        fun listDueRelayUpload(nowMs: Long): List<OutboxEntryMeta> =
            runOnIo {
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

        fun countPendingRelayUpload(nowMs: Long): Int =
            runOnIo { dao.listDueRelayUpload(nowMs).size }

        private fun <T> runOnIo(block: suspend () -> T): T = runBlocking(ioDispatcher) { block() }
    }

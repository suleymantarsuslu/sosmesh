package com.sosmesh.android.core.data.outbox

import com.sosmesh.android.core.data.di.IoDispatcher
import com.sosmesh.android.core.data.di.OutboxDefaultRetention
import com.sosmesh.contracts.transport.EnqueueInput
import com.sosmesh.contracts.transport.OutboxEntryMeta
import com.sosmesh.contracts.transport.OutboxQueueAdapter
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RoomOutboxQueueAdapter
    @Inject
    constructor(
        private val dao: OutboxDao,
        @OutboxDefaultRetention private val defaultRetentionMs: Long,
        @IoDispatcher private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO,
    ) : OutboxQueueAdapter {
        override suspend fun enqueue(
            input: EnqueueInput,
            nowMs: Long,
        ): OutboxEntryMeta =
            withContext(ioDispatcher) {
                enqueueOnDao(input, nowMs)
            }

        override suspend fun getByKey(
            sosId: String,
            digest: String,
        ): OutboxEntryMeta? =
            withContext(ioDispatcher) {
                dao.getByKey(sosId, digest)?.toMeta()
            }

        override suspend fun deleteEntry(
            sosId: String,
            digest: String,
        ): Boolean = withContext(ioDispatcher) { dao.deleteByKey(sosId, digest) > 0 }

        override suspend fun listAll(): List<OutboxEntryMeta> =
            withContext(ioDispatcher) {
                dao.listAll().map { it.toMeta() }
            }

        override suspend fun updateState(
            sosId: String,
            digest: String,
            state: String,
            nowMs: Long,
            lastError: String?,
        ): OutboxEntryMeta? =
            withContext(ioDispatcher) {
                val updated =
                    dao.updateStateFields(
                        sosId = sosId,
                        digest = digest,
                        state = state,
                        nowMs = nowMs,
                        lastError = lastError,
                    )
                if (updated == 0) return@withContext null
                dao.getByKey(sosId, digest)?.toMeta()
            }

        override suspend fun setRetryAt(
            sosId: String,
            digest: String,
            retryAtMs: Long,
            lastError: String?,
        ) {
            withContext(ioDispatcher) {
                dao.setRetryAtFields(
                    sosId = sosId,
                    digest = digest,
                    retryAtMs = retryAtMs,
                    lastError = lastError,
                )
            }
        }

        override suspend fun setUploadRetryAt(
            sosId: String,
            digest: String,
            retryAtMs: Long,
            lastError: String?,
        ) {
            withContext(ioDispatcher) {
                dao.setUploadRetryAtFields(
                    sosId = sosId,
                    digest = digest,
                    retryAtMs = retryAtMs,
                    lastError = lastError,
                )
            }
        }

        override suspend fun clearUploadRetry(
            sosId: String,
            digest: String,
        ) {
            withContext(ioDispatcher) {
                dao.clearUploadRetryFields(sosId, digest)
            }
        }

        override suspend fun countDueForSend(
            nowMs: Long,
            paused: Boolean,
        ): Int =
            withContext(ioDispatcher) {
                if (paused) {
                    0
                } else {
                    dao.countDueForSend(nowMs)
                }
            }

        override suspend fun purgeExpired(nowMs: Long): Int =
            withContext(ioDispatcher) {
                dao.deleteExpired(nowMs)
            }

        override fun close() {
            // Room database lifecycle managed by Hilt singleton.
        }

        private fun enqueueOnDao(
            input: EnqueueInput,
            nowMs: Long,
        ): OutboxEntryMeta {
            dao.getByKey(input.sosId, input.digest)?.let { return it.toMeta() }
            val retention = input.retentionMs ?: defaultRetentionMs
            val expiresAt = nowMs + retention
            val entity =
                OutboxEntity(
                    sos_id = input.sosId,
                    digest = input.digest,
                    origin = input.origin,
                    encrypted_blob = input.encryptedBlobBase64,
                    state = "LOCAL_SAVED",
                    retry_at = nowMs,
                    expires_at = expiresAt,
                    last_error = null,
                    created_at = nowMs,
                    updated_at = nowMs,
                    upload_retry_at = null,
                    upload_last_error = null,
                    upload_attempts = 0,
                )
            dao.insert(entity)
            return dao.getByKey(input.sosId, input.digest)?.toMeta()
                ?: error("outbox row missing immediately after insert")
        }

        private fun OutboxEntity.toMeta(): OutboxEntryMeta =
            OutboxEntryMeta(
                sosId = sos_id,
                digest = digest,
                origin = origin,
                encryptedBlobBase64 = encrypted_blob,
                state = state,
                retryAtMs = retry_at,
                expiresAtMs = expires_at,
                lastError = last_error,
                createdAtMs = created_at,
                updatedAtMs = updated_at,
            )
    }

package com.sosmesh.android.core.data.outbox

import com.sosmesh.android.core.data.di.IoDispatcher
import com.sosmesh.android.core.data.di.OutboxDefaultRetention
import com.sosmesh.contracts.transport.EnqueueInput
import com.sosmesh.contracts.transport.OutboxEntryMeta
import com.sosmesh.contracts.transport.OutboxQueueAdapter
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
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
        override fun enqueue(
            input: EnqueueInput,
            nowMs: Long,
        ): OutboxEntryMeta = runOnIo { enqueueOnDao(input, nowMs) }

        override fun getByKey(
            sosId: String,
            digest: String,
        ): OutboxEntryMeta? = runOnIo { dao.getByKey(sosId, digest)?.toMeta() }

        override fun listAll(): List<OutboxEntryMeta> =
            runOnIo { dao.listAll().map { it.toMeta() } }

        override fun updateState(
            sosId: String,
            digest: String,
            state: String,
            nowMs: Long,
            lastError: String?,
        ): OutboxEntryMeta? =
            runOnIo {
                val existing = dao.getByKey(sosId, digest) ?: return@runOnIo null
                val updated =
                    existing.copy(
                        state = state,
                        updated_at = nowMs,
                        last_error = lastError,
                    )
                dao.update(updated)
                updated.toMeta()
            }

        override fun setRetryAt(
            sosId: String,
            digest: String,
            retryAtMs: Long,
            lastError: String?,
        ) {
            runOnIo {
                val existing = dao.getByKey(sosId, digest) ?: return@runOnIo
                dao.update(
                    existing.copy(
                        retry_at = retryAtMs,
                        last_error = lastError,
                        updated_at = retryAtMs,
                    ),
                )
            }
        }

        override fun countDueForSend(
            nowMs: Long,
            paused: Boolean,
        ): Int =
            runOnIo {
                if (paused) {
                    0
                } else {
                    dao.countDueForSend(nowMs)
                }
            }

        override fun purgeExpired(nowMs: Long): Int = runOnIo { dao.deleteExpired(nowMs) }

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
                )
            dao.insert(entity)
            return dao.getByKey(input.sosId, input.digest)!!.toMeta()
        }

        private fun <T> runOnIo(block: suspend () -> T): T = runBlocking(ioDispatcher) { block() }

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

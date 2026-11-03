package com.sosmesh.android.core.data.outbox

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update

@Dao
interface OutboxDao {
    @Insert(onConflict = OnConflictStrategy.ABORT)
    fun insert(entity: OutboxEntity)

    @Query("SELECT * FROM outbox WHERE sos_id = :sosId AND digest = :digest LIMIT 1")
    fun getByKey(
        sosId: String,
        digest: String,
    ): OutboxEntity?

    @Query("SELECT * FROM outbox ORDER BY created_at ASC")
    fun listAll(): List<OutboxEntity>

    @Update
    fun update(entity: OutboxEntity)

    @Query(
        """
        UPDATE outbox SET state = :state, updated_at = :nowMs, last_error = :lastError
        WHERE sos_id = :sosId AND digest = :digest
        """,
    )
    fun updateStateFields(
        sosId: String,
        digest: String,
        state: String,
        nowMs: Long,
        lastError: String?,
    ): Int

    @Query(
        """
        UPDATE outbox SET retry_at = :retryAtMs, last_error = :lastError
        WHERE sos_id = :sosId AND digest = :digest
        """,
    )
    fun setRetryAtFields(
        sosId: String,
        digest: String,
        retryAtMs: Long,
        lastError: String?,
    ): Int

    @Query("DELETE FROM outbox WHERE expires_at <= :nowMs")
    fun deleteExpired(nowMs: Long): Int

    @Query(
        """
        SELECT COUNT(*) FROM outbox
        WHERE retry_at <= :nowMs AND state = 'LOCAL_SAVED'
        """,
    )
    fun countDueForSend(nowMs: Long): Int

    @Query(
        """
        SELECT * FROM outbox
        WHERE retry_at <= :nowMs AND state = 'LOCAL_SAVED' AND origin = 'relay'
        AND (last_error IS NULL OR last_error != 'needs_review')
        ORDER BY created_at ASC
        """,
    )
    fun listDueRelayUpload(nowMs: Long): List<OutboxEntity>

    @Query(
        """
        SELECT * FROM outbox
        WHERE retry_at <= :nowMs AND state = 'LOCAL_SAVED' AND origin = 'android'
        ORDER BY created_at ASC
        """,
    )
    fun listDueAndroidPeerSend(nowMs: Long): List<OutboxEntity>
}

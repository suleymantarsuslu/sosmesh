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
        ORDER BY created_at ASC
        """,
    )
    fun listDueRelayUpload(nowMs: Long): List<OutboxEntity>
}

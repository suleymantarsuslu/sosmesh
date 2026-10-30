package com.sosmesh.android.core.data.outbox

import androidx.room.Entity

@Entity(
    tableName = "outbox",
    primaryKeys = ["sos_id", "digest"],
)
data class OutboxEntity(
    val sos_id: String,
    val digest: String,
    val origin: String,
    val encrypted_blob: String,
    val state: String,
    val retry_at: Long,
    val expires_at: Long,
    val last_error: String?,
    val created_at: Long,
    val updated_at: Long,
)

package com.sosmesh.contracts.transport

import java.io.File
import java.sql.DriverManager

class JdbcSqliteOutboxQueue(
    dbPath: String,
    private val defaultRetentionMs: Long = StateTransitionLoader.load().defaultRetentionMs,
) : OutboxQueueAdapter {
    private val connection =
        DriverManager.getConnection(
            "jdbc:sqlite:${File(dbPath).absolutePath}?busy_timeout=5000",
        ).apply {
            createStatement().use { st ->
                st.execute("PRAGMA journal_mode=WAL")
                st.execute(
                    """
                    CREATE TABLE IF NOT EXISTS outbox (
                      sos_id TEXT NOT NULL,
                      digest TEXT NOT NULL,
                      origin TEXT NOT NULL,
                      encrypted_blob TEXT NOT NULL,
                      state TEXT NOT NULL,
                      retry_at INTEGER NOT NULL,
                      expires_at INTEGER NOT NULL,
                      last_error TEXT,
                      created_at INTEGER NOT NULL,
                      updated_at INTEGER NOT NULL,
                      upload_retry_at INTEGER,
                      upload_last_error TEXT,
                      upload_attempts INTEGER NOT NULL DEFAULT 0,
                      PRIMARY KEY (sos_id, digest)
                    )
                    """.trimIndent(),
                )
                try {
                    st.execute("ALTER TABLE outbox ADD COLUMN upload_retry_at INTEGER")
                } catch (_: Exception) {
                }
                try {
                    st.execute("ALTER TABLE outbox ADD COLUMN upload_last_error TEXT")
                } catch (_: Exception) {
                }
                try {
                    st.execute("ALTER TABLE outbox ADD COLUMN upload_attempts INTEGER NOT NULL DEFAULT 0")
                } catch (_: Exception) {
                }
            }
        }

    override suspend fun enqueue(
        input: EnqueueInput,
        nowMs: Long,
    ): OutboxEntryMeta {
        getByKey(input.sosId, input.digest)?.let { return it }
        val retention = input.retentionMs ?: defaultRetentionMs
        val expiresAt = nowMs + retention
        connection.prepareStatement(
            """
            INSERT INTO outbox (
              sos_id, digest, origin, encrypted_blob, state,
              retry_at, expires_at, last_error, created_at, updated_at,
              upload_retry_at, upload_last_error, upload_attempts
            ) VALUES (?, ?, ?, ?, 'LOCAL_SAVED', ?, ?, NULL, ?, ?, NULL, NULL, 0)
            """.trimIndent(),
        ).use { ps ->
            ps.setString(1, input.sosId)
            ps.setString(2, input.digest)
            ps.setString(3, input.origin)
            ps.setString(4, input.encryptedBlobBase64)
            ps.setLong(5, nowMs)
            ps.setLong(6, expiresAt)
            ps.setLong(7, nowMs)
            ps.setLong(8, nowMs)
            ps.executeUpdate()
        }
        return getByKey(input.sosId, input.digest)!!
    }

    override suspend fun getByKey(
        sosId: String,
        digest: String,
    ): OutboxEntryMeta? {
        connection.prepareStatement(
            "SELECT * FROM outbox WHERE sos_id = ? AND digest = ?",
        ).use { ps ->
            ps.setString(1, sosId)
            ps.setString(2, digest)
            ps.executeQuery().use { rs ->
                if (!rs.next()) return null
                return rowToMeta(rs)
            }
        }
    }

    override suspend fun listAll(): List<OutboxEntryMeta> {
        val list = mutableListOf<OutboxEntryMeta>()
        connection.createStatement().use { st ->
            st.executeQuery("SELECT * FROM outbox ORDER BY created_at ASC").use { rs ->
                while (rs.next()) {
                    list.add(rowToMeta(rs))
                }
            }
        }
        return list
    }

    override suspend fun updateState(
        sosId: String,
        digest: String,
        state: String,
        nowMs: Long,
        lastError: String?,
    ): OutboxEntryMeta? {
        connection.prepareStatement(
            "UPDATE outbox SET state = ?, updated_at = ?, last_error = ? WHERE sos_id = ? AND digest = ?",
        ).use { ps ->
            ps.setString(1, state)
            ps.setLong(2, nowMs)
            ps.setString(3, lastError)
            ps.setString(4, sosId)
            ps.setString(5, digest)
            if (ps.executeUpdate() == 0) return null
        }
        return getByKey(sosId, digest)
    }

    override suspend fun setRetryAt(
        sosId: String,
        digest: String,
        retryAtMs: Long,
        lastError: String?,
    ) {
        connection.prepareStatement(
            "UPDATE outbox SET retry_at = ?, last_error = ? WHERE sos_id = ? AND digest = ?",
        ).use { ps ->
            ps.setLong(1, retryAtMs)
            ps.setString(2, lastError)
            ps.setString(3, sosId)
            ps.setString(4, digest)
            ps.executeUpdate()
        }
    }

    override suspend fun setUploadRetryAt(
        sosId: String,
        digest: String,
        retryAtMs: Long,
        lastError: String?,
    ) {
        connection.prepareStatement(
            "UPDATE outbox SET upload_retry_at = ?, upload_last_error = ?, upload_attempts = upload_attempts + 1 WHERE sos_id = ? AND digest = ?",
        ).use { ps ->
            ps.setLong(1, retryAtMs)
            ps.setString(2, lastError)
            ps.setString(3, sosId)
            ps.setString(4, digest)
            ps.executeUpdate()
        }
    }

    override suspend fun clearUploadRetry(
        sosId: String,
        digest: String,
    ) {
        connection.prepareStatement(
            "UPDATE outbox SET upload_retry_at = NULL, upload_last_error = NULL WHERE sos_id = ? AND digest = ?",
        ).use { ps ->
            ps.setString(1, sosId)
            ps.setString(2, digest)
            ps.executeUpdate()
        }
    }

    override suspend fun countDueForSend(
        nowMs: Long,
        paused: Boolean,
    ): Int {
        if (paused) return 0
        connection.prepareStatement(
            """
            SELECT COUNT(*) FROM outbox
            WHERE retry_at <= ? AND state NOT IN ('FAILED', 'EXPIRED')
            """.trimIndent(),
        ).use { ps ->
            ps.setLong(1, nowMs)
            ps.executeQuery().use { rs ->
                rs.next()
                return rs.getInt(1)
            }
        }
    }

    override suspend fun purgeExpired(nowMs: Long): Int {
        connection.prepareStatement("DELETE FROM outbox WHERE expires_at <= ?").use { ps ->
            ps.setLong(1, nowMs)
            return ps.executeUpdate()
        }
    }

    override fun close() {
        connection.close()
    }

    private fun rowToMeta(rs: java.sql.ResultSet): OutboxEntryMeta =
        OutboxEntryMeta(
            sosId = rs.getString("sos_id"),
            digest = rs.getString("digest"),
            origin = rs.getString("origin"),
            encryptedBlobBase64 = rs.getString("encrypted_blob"),
            state = rs.getString("state"),
            retryAtMs = rs.getLong("retry_at"),
            expiresAtMs = rs.getLong("expires_at"),
            lastError = rs.getString("last_error"),
            createdAtMs = rs.getLong("created_at"),
            updatedAtMs = rs.getLong("updated_at"),
        )
}

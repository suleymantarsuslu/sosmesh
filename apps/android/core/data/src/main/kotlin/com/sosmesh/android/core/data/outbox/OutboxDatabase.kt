package com.sosmesh.android.core.data.outbox

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(entities = [OutboxEntity::class], version = 2, exportSchema = true)
abstract class OutboxDatabase : RoomDatabase() {
    abstract fun outboxDao(): OutboxDao

    companion object {
        val MIGRATION_1_2 =
            object : Migration(1, 2) {
                override fun migrate(db: SupportSQLiteDatabase) {
                    db.execSQL("ALTER TABLE outbox ADD COLUMN upload_retry_at INTEGER")
                    db.execSQL("ALTER TABLE outbox ADD COLUMN upload_last_error TEXT")
                    db.execSQL("ALTER TABLE outbox ADD COLUMN upload_attempts INTEGER NOT NULL DEFAULT 0")
                }
            }
    }
}

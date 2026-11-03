package com.sosmesh.android.core.data.outbox

import androidx.room.Room
import androidx.room.testing.MigrationTestHelper
import androidx.sqlite.db.framework.FrameworkSQLiteOpenHelperFactory
import androidx.test.core.app.ApplicationProvider
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class OutboxDatabaseMigrationTest {
    @get:Rule
    val helper: MigrationTestHelper =
        MigrationTestHelper(
            InstrumentationRegistry.getInstrumentation(),
            OutboxDatabase::class.java,
            emptyList(),
            FrameworkSQLiteOpenHelperFactory(),
        )

    @Test
    fun migrate1To2_addsUploadColumns() {
        val db = helper.createDatabase("test-db", 1)
        db.execSQL(
            """
            INSERT INTO outbox (sos_id, digest, origin, encrypted_blob, state, retry_at, expires_at, last_error, created_at, updated_at)
            VALUES ('test-id', 'test-digest', 'android', 'YQ==', 'LOCAL_SAVED', 1000, 99999, NULL, 1000, 1000)
            """.trimIndent(),
        )
        db.close()

        val migratedDb = helper.runMigrationsAndValidate("test-db", 2, true, OutboxDatabase.MIGRATION_1_2)
        val cursor =
            migratedDb.query(
                "SELECT sos_id, upload_retry_at, upload_last_error, upload_attempts FROM outbox WHERE sos_id = 'test-id'",
            )
        cursor.moveToFirst()
        assertEquals("test-id", cursor.getString(0))
        assertEquals(true, cursor.isNull(1))
        assertEquals(true, cursor.isNull(2))
        assertEquals(0, cursor.getInt(3))
        cursor.close()
        migratedDb.close()
    }
}

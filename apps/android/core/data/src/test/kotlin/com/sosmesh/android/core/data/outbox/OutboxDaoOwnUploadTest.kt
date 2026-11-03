package com.sosmesh.android.core.data.outbox

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class OutboxDaoOwnUploadTest {
    private lateinit var db: OutboxDatabase
    private lateinit var dao: OutboxDao

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        db =
            Room.inMemoryDatabaseBuilder(context, OutboxDatabase::class.java)
                .allowMainThreadQueries()
                .build()
        dao = db.outboxDao()
    }

    @After
    fun tearDown() {
        db.close()
    }

    @Test
    fun listDueOwnUpload_returnsAndroidOrigin() =
        runBlocking {
            dao.insert(
                OutboxEntity(
                    sos_id = "android-1",
                    digest = "d1",
                    origin = "android",
                    encrypted_blob = "YQ==",
                    state = "LOCAL_SAVED",
                    retry_at = 1_000L,
                    expires_at = 99_999L,
                    last_error = null,
                    created_at = 1_000L,
                    updated_at = 1_000L,
                    upload_retry_at = null,
                    upload_last_error = null,
                    upload_attempts = 0,
                ),
            )
            val due = dao.listDueOwnUpload(nowMs = 2_000L)
            assertEquals(1, due.size)
            assertEquals("android-1", due[0].sos_id)
        }

    @Test
    fun listDueOwnUpload_returnsWearOsOrigin() =
        runBlocking {
            dao.insert(
                OutboxEntity(
                    sos_id = "wear-1",
                    digest = "d2",
                    origin = "wear_os",
                    encrypted_blob = "YQ==",
                    state = "LOCAL_SAVED",
                    retry_at = 1_000L,
                    expires_at = 99_999L,
                    last_error = null,
                    created_at = 1_000L,
                    updated_at = 1_000L,
                    upload_retry_at = null,
                    upload_last_error = null,
                    upload_attempts = 0,
                ),
            )
            val due = dao.listDueOwnUpload(nowMs = 2_000L)
            assertEquals(1, due.size)
            assertEquals("wear-1", due[0].sos_id)
        }

    @Test
    fun listDueOwnUpload_ignoresRelayOrigin() =
        runBlocking {
            dao.insert(
                OutboxEntity(
                    sos_id = "relay-1",
                    digest = "d3",
                    origin = "relay",
                    encrypted_blob = "YQ==",
                    state = "LOCAL_SAVED",
                    retry_at = 1_000L,
                    expires_at = 99_999L,
                    last_error = null,
                    created_at = 1_000L,
                    updated_at = 1_000L,
                    upload_retry_at = null,
                    upload_last_error = null,
                    upload_attempts = 0,
                ),
            )
            val due = dao.listDueOwnUpload(nowMs = 2_000L)
            assertEquals(0, due.size)
        }

    @Test
    fun listDueOwnUpload_ignoresNeedsReview() =
        runBlocking {
            dao.insert(
                OutboxEntity(
                    sos_id = "android-review",
                    digest = "d4",
                    origin = "android",
                    encrypted_blob = "YQ==",
                    state = "LOCAL_SAVED",
                    retry_at = 1_000L,
                    expires_at = 99_999L,
                    last_error = null,
                    created_at = 1_000L,
                    updated_at = 1_000L,
                    upload_retry_at = null,
                    upload_last_error = "needs_review",
                    upload_attempts = 0,
                ),
            )
            val due = dao.listDueOwnUpload(nowMs = 2_000L)
            assertEquals(0, due.size)
        }

    @Test
    fun listDueOwnUpload_includesPeerReceived() =
        runBlocking {
            dao.insert(
                OutboxEntity(
                    sos_id = "peer-received",
                    digest = "d5",
                    origin = "android",
                    encrypted_blob = "YQ==",
                    state = "PEER_RECEIVED",
                    retry_at = 1_000L,
                    expires_at = 99_999L,
                    last_error = null,
                    created_at = 1_000L,
                    updated_at = 1_000L,
                    upload_retry_at = null,
                    upload_last_error = null,
                    upload_attempts = 0,
                ),
            )
            val due = dao.listDueOwnUpload(nowMs = 2_000L)
            assertEquals(1, due.size)
            assertEquals("peer-received", due[0].sos_id)
        }

    @Test
    fun listDueOwnUpload_respectsUploadRetryAt() =
        runBlocking {
            dao.insert(
                OutboxEntity(
                    sos_id = "future-retry",
                    digest = "d6",
                    origin = "android",
                    encrypted_blob = "YQ==",
                    state = "LOCAL_SAVED",
                    retry_at = 1_000L,
                    expires_at = 99_999L,
                    last_error = null,
                    created_at = 1_000L,
                    updated_at = 1_000L,
                    upload_retry_at = 5_000L,
                    upload_last_error = "no_network",
                    upload_attempts = 2,
                ),
            )
            val dueBefore = dao.listDueOwnUpload(nowMs = 2_000L)
            assertEquals(0, dueBefore.size)
            val dueAfter = dao.listDueOwnUpload(nowMs = 6_000L)
            assertEquals(1, dueAfter.size)
            assertEquals("future-retry", dueAfter[0].sos_id)
        }
}

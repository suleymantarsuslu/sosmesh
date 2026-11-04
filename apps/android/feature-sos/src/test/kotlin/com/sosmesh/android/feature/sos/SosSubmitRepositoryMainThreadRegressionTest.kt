package com.sosmesh.android.feature.sos

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.sosmesh.android.core.data.fixtures.AndroidStateTransitionLoader
import com.sosmesh.android.core.data.outbox.OutboxDatabase
import com.sosmesh.android.core.data.outbox.OutboxUploadScheduler
import com.sosmesh.android.core.data.outbox.RoomOutboxQueueAdapter
import com.sosmesh.android.core.data.sos.DevTestCryptoConfig
import com.sosmesh.android.core.data.sos.LocationSnapshot
import com.sosmesh.android.core.data.sos.SosComposeRequest
import com.sosmesh.android.core.data.sos.SosMessageComposer
import com.sosmesh.android.core.model.SosType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [30])
class SosSubmitRepositoryMainThreadRegressionTest {
    private lateinit var db: OutboxDatabase
    private lateinit var adapter: RoomOutboxQueueAdapter
    private lateinit var repository: SosSubmitRepository

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        db =
            Room.inMemoryDatabaseBuilder(context, OutboxDatabase::class.java)
                .build()
        val fixture =
            AndroidStateTransitionLoader.load(
                javaClass.classLoader!!.getResourceAsStream("state-transitions.json")!!,
            )
        val adapter = RoomOutboxQueueAdapter(db.outboxDao(), fixture.defaultRetentionMs, Dispatchers.IO)
        this.adapter = adapter
        repository =
            SosSubmitRepository(
                composer = SosMessageComposer(DevTestCryptoConfig.config()),
                outbox = adapter,
                uploadScheduler = NoOpUploadScheduler,
                ioDispatcher = Dispatchers.IO,
                senderContext = { null },
            )
    }

    private object NoOpUploadScheduler : OutboxUploadScheduler {
        override fun scheduleUpload(
            nowMs: Long,
            delayMs: Long,
        ) {
        }

        override fun cancelUpload() {
        }
    }

    @After
    fun tearDown() {
        db.close()
    }

    @Test
    fun submit_fromMainThread_withoutAllowMainThreadQueries_enqueuesRow() =
        runBlocking {
            val composed =
                repository.submit(
                    SosComposeRequest(
                        sosType = SosType.DIGER,
                        personCount = 1,
                        note = "",
                        location = LocationSnapshot.unknown(),
                        languageTag = "tr",
                        nowMs = 1L,
                    ),
                )
            assertEquals(composed.message.id, adapter.listAll().single().sosId)
        }
}

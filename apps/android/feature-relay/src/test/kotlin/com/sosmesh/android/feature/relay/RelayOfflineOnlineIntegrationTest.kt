package com.sosmesh.android.feature.relay

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.sosmesh.android.core.data.fixtures.AndroidStateTransitionLoader
import com.sosmesh.android.core.data.outbox.OutboxDatabase
import com.sosmesh.android.core.data.outbox.RelayOutboxReader
import com.sosmesh.android.core.data.outbox.RoomOutboxQueueAdapter
import com.sosmesh.android.feature.relay.battery.RelayBatteryPolicy
import com.sosmesh.android.feature.relay.battery.RelayBatterySnapshot
import com.sosmesh.android.feature.relay.settings.RelayHourlyDataBudget
import com.sosmesh.android.feature.relay.uplink.RelayIngestConfig
import com.sosmesh.android.feature.relay.uplink.RelayIngestRequestBuilder
import com.sosmesh.android.feature.relay.uplink.RelayIngestResult
import com.sosmesh.android.feature.relay.uplink.RelayIngestUplink
import com.sosmesh.android.feature.relay.uplink.ServerAcceptedReceipt
import com.sosmesh.android.feature.relay.uplink.ServerReceiptVerifier
import com.sosmesh.android.feature.relay.upload.RelayUploadExecutor
import com.sosmesh.contracts.transport.EnqueueInput
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.security.KeyPairGenerator
import java.security.Signature
import java.util.Base64

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class RelayOfflineOnlineIntegrationTest {
    private val context = ApplicationProvider.getApplicationContext<android.content.Context>()
    private lateinit var db: OutboxDatabase
    private lateinit var adapter: RoomOutboxQueueAdapter
    private lateinit var reader: RelayOutboxReader
    private lateinit var settings: MutableRelaySettings
    private lateinit var executor: RelayUploadExecutor
    private lateinit var scriptedUplink: ScriptedVerifiedUplink

    @Before
    fun setUp() {
        db =
            Room.inMemoryDatabaseBuilder(context, OutboxDatabase::class.java)
                .allowMainThreadQueries()
                .build()
        val fixture =
            AndroidStateTransitionLoader.load(
                javaClass.classLoader!!.getResourceAsStream("state-transitions.json")!!,
            )
        adapter = RoomOutboxQueueAdapter(db.outboxDao(), fixture.defaultRetentionMs, Dispatchers.IO)
        reader = RelayOutboxReader(db.outboxDao(), kotlinx.coroutines.Dispatchers.IO)
        settings = MutableRelaySettings(relayEnabled = true)
        val budget = RelayHourlyDataBudget(context)
        budget.resetForTests()
        scriptedUplink = ScriptedVerifiedUplink()
        val policy = RelayBatteryPolicy(settings, budget)
        executor = RelayUploadExecutor(settings, policy, budget, reader, adapter, scriptedUplink, com.sosmesh.android.feature.relay.uplink.RelayIngestConfig("https://example.invalid/v1/ingest", "", "a".repeat(64)), null, null, null, RelayDeliveryCounter(context))
    }

    @After
    fun tearDown() {
        db.close()
    }

    @Test
    fun networkRestored_singleVerifiedUpload_setsServerAccepted() =
        runBlocking {
            val wire = javaClass.classLoader!!.getResourceAsStream("valid-sos.json")!!.readBytes()
            val blob = Base64.getEncoder().encodeToString(wire)
            val root = Json.parseToJsonElement(String(wire)).jsonObject
            val sosId = root["id"]!!.jsonPrimitive.content

            adapter.enqueue(
                EnqueueInput(
                    sosId = sosId,
                    digest = "offline-online-digest",
                    origin = "relay",
                    encryptedBlobBase64 = blob,
                ),
                nowMs = 100L,
            )

            val offline =
                executor.runUploadCycle(
                    nowMs = 200L,
                    networkConnected = false,
                    battery = RelayBatterySnapshot(90, false),
                )
            assertNotNull(offline.scheduledRetryMs)
            assertEquals(0, offline.uploaded)
            assertEquals(0, scriptedUplink.uploadCallCount)

            val online =
                executor.runUploadCycle(
                    nowMs = 70_000L,
                    networkConnected = true,
                    battery = RelayBatterySnapshot(90, false),
                )
            assertEquals(1, scriptedUplink.uploadCallCount)
            assertEquals(1, online.uploaded)
            val entry = adapter.getByKey(sosId, "offline-online-digest")
            assertEquals("SERVER_ACCEPTED", entry!!.state)
        }

    private class ScriptedVerifiedUplink : RelayIngestUplink {
        var uploadCallCount: Int = 0
        private val keyPair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
        private val publicSpkiBase64 = Base64.getEncoder().encodeToString(keyPair.public.encoded)
        private val config =
            RelayIngestConfig(
                ingestUrl = "http://127.0.0.1/ingest",
                receiptVerifyPublicKeySpkiBase64 = publicSpkiBase64,
                relayIdHex = "c".repeat(64),
                requireHttps = false,
            )
        private val verifier = ServerReceiptVerifier(config)

        override fun uploadOutboxEntry(
            sosId: String,
            digest: String,
            encryptedBlobBase64: String,
        ): RelayIngestResult {
            uploadCallCount++
            val (body, packetHash) =
                RelayIngestRequestBuilder.buildRequestBody(
                    encryptedBlobBase64,
                    config,
                    System.currentTimeMillis(),
                )
            val messageId = body["sosMessage"]!!.jsonObject["id"]!!.jsonPrimitive.content
            val timestamp = "2026-10-31T12:00:00.000Z"
            val payload = "SERVER_ACCEPTED|$messageId|$packetHash|$timestamp"
            val signer = Signature.getInstance("Ed25519")
            signer.initSign(keyPair.private)
            signer.update(payload.toByteArray(Charsets.UTF_8))
            val receipt =
                ServerAcceptedReceipt(
                    ackType = "SERVER_ACCEPTED",
                    messageId = messageId,
                    packetHash = packetHash,
                    timestamp = timestamp,
                    signature = Base64.getEncoder().encodeToString(signer.sign()),
                )
            return if (verifier.verify(receipt, messageId, packetHash)) {
                RelayIngestResult.Success(null)
            } else {
                RelayIngestResult.InvalidReceipt
            }
        }
    }
}

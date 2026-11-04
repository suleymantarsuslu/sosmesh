package com.sosmesh.android.feature.relay.uplink

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import com.sosmesh.android.meshv2.v2.DeliveryTombstone
import com.sosmesh.android.meshv2.v2.MeshV2Runtime
import com.sosmesh.android.meshv2.v2.ReceiptLookupItem
import com.sosmesh.android.meshv2.v2.ReceiptLookupRequest
import com.sosmesh.android.meshv2.v2.ReceiptLookupResponse
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class HttpRelayIngestUplink
    @Inject
    constructor(
        private val config: RelayIngestConfig,
        private val receiptVerifier: ServerReceiptVerifier,
        private val meshV2: MeshV2Runtime,
    ) : RelayIngestUplink {
        private val json = Json { ignoreUnknownKeys = true }

        override fun uploadOutboxEntry(
            sosId: String,
            digest: String,
            encryptedBlobBase64: String,
        ): RelayIngestResult = uploadOutboxEntry(sosId, digest, encryptedBlobBase64, config.hopCount)

        override fun uploadOutboxEntry(
            sosId: String,
            digest: String,
            encryptedBlobBase64: String,
            hopCount: Int,
        ): RelayIngestResult {
            if (config.ingestUrl.isBlank()) {
                return RelayIngestResult.HttpError(500, "missing_ingest_url")
            }
            if (config.requireHttps && !config.ingestUrl.startsWith("https://", ignoreCase = true)) {
                return RelayIngestResult.HttpError(500, "ingest_url_must_be_https")
            }
            val nowMs = System.currentTimeMillis()
            val (body, packetHash) =
                try {
                    RelayIngestRequestBuilder.buildRequestBody(encryptedBlobBase64, config.copy(hopCount = hopCount.coerceIn(0, 8)), nowMs)
                } catch (_: Exception) {
                    return RelayIngestResult.HttpError(400, "invalid_wire_payload")
                }
            val messageId =
                body["sosMessage"]!!
                    .jsonObject["id"]!!
                    .jsonPrimitive.content
            val payload = json.encodeToString(JsonObject.serializer(), body)
            return try {
                postJson(config.ingestUrl, payload, messageId, packetHash)
            } catch (_: IOException) {
                RelayIngestResult.NoNetwork
            }
        }

        private fun postJson(
            endpoint: String,
            payload: String,
            expectedMessageId: String,
            expectedPacketHash: String,
        ): RelayIngestResult {
            val connection =
                (URL(endpoint).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 15_000
                    readTimeout = 15_000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json; charset=utf-8")
                    setRequestProperty("Accept", "application/json")
                }
            connection.outputStream.use { stream ->
                stream.write(payload.toByteArray(Charsets.UTF_8))
            }
            val code = connection.responseCode
            meshV2.onApiResponse(code, System.currentTimeMillis())
            when (code) {
                HttpURLConnection.HTTP_OK -> {
                    val responseText =
                        connection.inputStream.bufferedReader().use { it.readText() }
                    return parseVerifiedSuccess(responseText, expectedMessageId, expectedPacketHash)
                }
                429 -> {
                    val retryAfterHeader = connection.getHeaderField("Retry-After")
                    val retrySeconds = retryAfterHeader?.toLongOrNull() ?: 60L
                    return RelayIngestResult.RateLimited(retrySeconds * 1_000L)
                }
                409 -> return RelayIngestResult.MessageIdConflict
                else -> {
                    val err =
                        connection.errorStream?.bufferedReader()?.use { it.readText() }
                            ?: "http_$code"
                    return RelayIngestResult.HttpError(code, err.take(120))
                }
            }
        }

        private fun parseVerifiedSuccess(
            responseText: String,
            expectedMessageId: String,
            expectedPacketHash: String,
        ): RelayIngestResult {
            val root = json.parseToJsonElement(responseText).jsonObject
            val receiptObj = root["receipt"]?.jsonObject ?: return RelayIngestResult.InvalidReceipt
            val receipt =
                ServerAcceptedReceipt(
                    ackType = receiptObj["ackType"]?.jsonPrimitive?.content ?: return RelayIngestResult.InvalidReceipt,
                    messageId = receiptObj["messageId"]?.jsonPrimitive?.content ?: return RelayIngestResult.InvalidReceipt,
                    packetHash = receiptObj["packetHash"]?.jsonPrimitive?.content ?: return RelayIngestResult.InvalidReceipt,
                    timestamp = receiptObj["timestamp"]?.jsonPrimitive?.content ?: return RelayIngestResult.InvalidReceipt,
                    signature = receiptObj["signature"]?.jsonPrimitive?.content ?: return RelayIngestResult.InvalidReceipt,
                )
            return if (receiptVerifier.verify(receipt, expectedMessageId, expectedPacketHash)) {
                meshV2.onVerifiedReceipt(
                    DeliveryTombstone(
                        messageId = receipt.messageId,
                        packetHash = receipt.packetHash,
                        timestamp = receipt.timestamp,
                        signature = receipt.signature,
                    ),
                    System.currentTimeMillis(),
                )
                val uploadToken = receiptObj["uploadToken"]?.jsonPrimitive?.content
                RelayIngestResult.Success(uploadToken)
            } else {
                RelayIngestResult.InvalidReceipt
            }
        }

        /**
         * mesh-v2 §6: POST /v1/receipts/lookup for carried copies (≤ 64 items). Verified receipts become tombstones.
         * 404 (old server) or any failure ⇒ empty list. Must be called off the main thread.
         */
        fun lookupReceipts(items: List<ReceiptLookupItem>): List<DeliveryTombstone> {
            if (items.isEmpty() || !config.ingestUrl.startsWith("https://", ignoreCase = true) && config.requireHttps) return emptyList()
            val endpoint = config.ingestUrl.removeSuffix(RelayIngestConfig.DEFAULT_INGEST_PATH) + RECEIPT_LOOKUP_PATH
            return try {
                val connection =
                    (URL(endpoint).openConnection() as HttpURLConnection).apply {
                        requestMethod = "POST"
                        connectTimeout = 15_000
                        readTimeout = 15_000
                        doOutput = true
                        setRequestProperty("Content-Type", "application/json; charset=utf-8")
                        setRequestProperty("Accept", "application/json")
                    }
                val body = json.encodeToString(ReceiptLookupRequest.serializer(), ReceiptLookupRequest(items.take(64)))
                connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                val code = connection.responseCode
                meshV2.onApiResponse(code, System.currentTimeMillis())
                if (code != HttpURLConnection.HTTP_OK) return emptyList()
                val text = connection.inputStream.bufferedReader().use { it.readText() }
                val receipts = json.decodeFromString(ReceiptLookupResponse.serializer(), text).receipts
                val nowMs = System.currentTimeMillis()
                receipts.forEach { meshV2.onVerifiedReceipt(it, nowMs) }
                receipts
            } catch (_: Exception) {
                emptyList()
            }
        }

        companion object {
            const val RECEIPT_LOOKUP_PATH = "/v1/receipts/lookup"
        }
    }

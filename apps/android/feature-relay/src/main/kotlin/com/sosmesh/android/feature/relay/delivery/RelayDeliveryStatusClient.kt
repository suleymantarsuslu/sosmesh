package com.sosmesh.android.feature.relay.delivery

import com.sosmesh.android.feature.relay.uplink.RelayIngestConfig
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import javax.inject.Inject
import javax.inject.Singleton

@Serializable
data class RelayDeliveryStatusRequest(
    val messageIds: List<String>,
)

@Serializable
data class RelayDeliveryStatusResponse(
    val delivered: List<String>,
)

@Singleton
class RelayDeliveryStatusClient
    @Inject
    constructor(
        private val config: RelayIngestConfig,
    ) {
        private val json = Json { ignoreUnknownKeys = true }

        suspend fun checkDeliveryStatus(messageIds: List<String>): List<String> {
            if (messageIds.isEmpty()) return emptyList()
            if (config.ingestUrl.isBlank()) return emptyList()
            if (config.requireHttps && !config.ingestUrl.startsWith("https://", ignoreCase = true)) return emptyList()

            val endpoint = config.ingestUrl.removeSuffix(RelayIngestConfig.DEFAULT_INGEST_PATH) + DELIVERY_STATUS_PATH
            return try {
                postDeliveryStatusRequest(endpoint, messageIds.take(200))
            } catch (_: IOException) {
                emptyList()
            } catch (_: Exception) {
                emptyList()
            }
        }

        private fun postDeliveryStatusRequest(
            endpoint: String,
            messageIds: List<String>,
        ): List<String> {
            val connection =
                (URL(endpoint).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 15_000
                    readTimeout = 15_000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json; charset=utf-8")
                    setRequestProperty("Accept", "application/json")
                }

            val request = RelayDeliveryStatusRequest(messageIds)
            val payload = json.encodeToString(RelayDeliveryStatusRequest.serializer(), request)

            connection.outputStream.use { stream ->
                stream.write(payload.toByteArray(Charsets.UTF_8))
            }

            val code = connection.responseCode
            if (code != HttpURLConnection.HTTP_OK) {
                return emptyList()
            }

            val responseText = connection.inputStream.bufferedReader().use { it.readText() }
            val response = json.decodeFromString(RelayDeliveryStatusResponse.serializer(), responseText)
            return response.delivered
        }

        companion object {
            const val DELIVERY_STATUS_PATH = "/v1/device/relay/delivery-status"
        }
    }

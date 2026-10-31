package com.sosmesh.android.feature.relay.uplink

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.Instant
import java.util.Base64

object RelayIngestRequestBuilder {
    private val json = Json { ignoreUnknownKeys = true }

    fun buildRequestBody(
        encryptedBlobBase64: String,
        config: RelayIngestConfig,
        nowMs: Long,
    ): Pair<JsonObject, String> {
        val wireBytes = Base64.getDecoder().decode(encryptedBlobBase64)
        val sosMessage =
            json.parseToJsonElement(String(wireBytes, Charsets.UTF_8)).let { element ->
                require(element is JsonObject) { "sos wire payload must be a JSON object" }
                element
            }
        val packetHash = IngestPacketHash.computePacketHash(sosMessage)
        val relayTimestamp = Instant.ofEpochMilli(nowMs).toString()
        val body =
            buildJsonObject {
                put("sosMessage", sosMessage)
                put(
                    "relayInfo",
                    buildJsonObject {
                        put("relayId", config.relayIdHex)
                        put("hopCount", config.hopCount)
                        put("relayTimestamp", relayTimestamp)
                    },
                )
                put(
                    "transport",
                    buildJsonObject {
                        put("ttlSeconds", config.ttlSeconds)
                        put("packetHash", packetHash)
                    },
                )
            }
        return body to packetHash
    }
}

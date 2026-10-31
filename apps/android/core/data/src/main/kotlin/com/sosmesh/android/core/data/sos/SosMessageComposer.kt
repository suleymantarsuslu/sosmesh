package com.sosmesh.android.core.data.sos

import com.sosmesh.android.core.model.SosType
import com.sosmesh.ble.BleProtocol
import com.sosmesh.contracts.Crypto
import com.sosmesh.contracts.CryptoConfig
import com.sosmesh.contracts.Envelope
import com.sosmesh.contracts.Location
import com.sosmesh.contracts.SosMessage
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.util.Base64
import java.util.UUID

data class SosComposeRequest(
    val sosType: SosType,
    val personCount: Int?,
    val note: String,
    val location: LocationSnapshot,
    val languageTag: String,
    val nowMs: Long,
)

data class ComposedSosMessage(
    val message: SosMessage,
    val messageJson: String,
    val encryptedBlobBase64: String,
    val digest: String,
)

class SosMessageComposer(
    private val cryptoConfig: CryptoConfig,
    private val json: Json = canonicalJson,
) {
    fun compose(request: SosComposeRequest): ComposedSosMessage {
        val isoTimestamp = instantToIso8601(Instant.ofEpochMilli(request.nowMs))
        val messageId = UUID.randomUUID().toString()
        val trimmedNote = request.note.trim().ifEmpty { null }

        val inner =
            SosInnerPayload(
                sos_type = request.sosType.wireValue,
                person_count = request.personCount,
                note = trimmedNote,
                location =
                    SosInnerLocation(
                        latitude = request.location.latitude,
                        longitude = request.location.longitude,
                        accuracy_meters = request.location.accuracyMeters,
                        timestamp = isoTimestamp,
                    ),
                language = normalizeLanguage(request.languageTag),
            )
        val innerBytes = json.encodeToString(inner).toByteArray(Charsets.UTF_8)

        val envelopeMap =
            buildEnvelopeMap(
                request.location,
                isoTimestamp,
            )
        val encrypted = Crypto.encryptPayload(innerBytes, envelopeMap, cryptoConfig)
        val encryptedPayloadString = json.encodeToString(encrypted)

        val envelope =
            Envelope(
                timestamp = isoTimestamp,
                location =
                    Location(
                        latitude = request.location.latitude,
                        longitude = request.location.longitude,
                        accuracy = request.location.accuracyMeters,
                    ),
                priority = 1,
                ackLevel = "DEVICE_STORED",
                relayCount = 0,
            )

        val message =
            SosMessage(
                version = 1,
                id = messageId,
                envelope = envelope,
                encryptedPayload = encryptedPayloadString,
                signature = null,
            )

        SosMessageSchemaValidator.validate(message)

        val messageJson = json.encodeToString(message)
        val messageBytes = messageJson.toByteArray(Charsets.UTF_8)
        val digest = Base64.getEncoder().encodeToString(BleProtocol.calculateSHA256(messageBytes))
        val blob = Base64.getEncoder().encodeToString(messageBytes)

        return ComposedSosMessage(
            message = message,
            messageJson = messageJson,
            encryptedBlobBase64 = blob,
            digest = digest,
        )
    }

    private fun buildEnvelopeMap(
        location: LocationSnapshot,
        isoTimestamp: String,
    ): Map<String, Any> {
        val locationMap =
            linkedMapOf<String, Any>(
                "latitude" to location.latitude,
                "longitude" to location.longitude,
            )
        location.accuracyMeters?.let { locationMap["accuracy"] = it }
        return mapOf(
            "timestamp" to isoTimestamp,
            "location" to locationMap,
            "priority" to 1,
        )
    }

    private fun normalizeLanguage(tag: String): String =
        when {
            tag.lowercase().startsWith("tr") -> "tr"
            else -> "en"
        }

    companion object {
        private val canonicalJson =
            Json {
                prettyPrint = false
                encodeDefaults = true
                ignoreUnknownKeys = false
            }

        fun instantToIso8601(instant: Instant): String = DateTimeFormatter.ISO_INSTANT.format(instant)
    }
}

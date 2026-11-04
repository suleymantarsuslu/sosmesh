package com.sosmesh.android.core.data.sos

import com.sosmesh.android.core.model.SosType
import com.sosmesh.ble.BleProtocol
import com.sosmesh.contracts.Crypto
import com.sosmesh.contracts.CryptoConfig
import com.sosmesh.contracts.Envelope
import com.sosmesh.contracts.Location
import com.sosmesh.contracts.LocationStatus
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
    val messageIdOverride: String? = null,
    /** mesh-v2: when set, the encrypted inner payload is SosInnerPayloadV2 (senderKey, seq, optional profile). */
    val sender: com.sosmesh.android.core.data.profile.SosSenderContext? = null,
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
        val messageId = request.messageIdOverride?.takeIf { it.isNotBlank() } ?: UUID.randomUUID().toString()
        val trimmedNote = request.note.trim().ifEmpty { null }
        val locationStatus = locationStatusWire(request.location)

        val innerLocation =
            if (request.location.isKnown) {
                val lat = requireNotNull(request.location.latitude) { "known location requires latitude" }
                val lng = requireNotNull(request.location.longitude) { "known location requires longitude" }
                SosInnerLocation(
                    latitude = lat,
                    longitude = lng,
                    accuracy_meters = request.location.accuracyMeters,
                    timestamp = isoTimestamp,
                )
            } else {
                null
            }

        val inner =
            SosInnerPayload(
                sos_type = request.sosType.wireValue,
                person_count = request.personCount,
                note = trimmedNote,
                location = innerLocation,
                language = normalizeLanguage(request.languageTag),
            )
        val innerBytes =
            request.sender?.let { sender -> innerV2Bytes(request, sender, isoTimestamp, innerLocation) }
                ?: json.encodeToString(inner).toByteArray(Charsets.UTF_8)

        val envelopeMap =
            buildEnvelopeMap(
                request.location,
                locationStatus,
                isoTimestamp,
            )
        val encrypted = Crypto.encryptPayload(innerBytes, envelopeMap, cryptoConfig)
        val encryptedPayloadString = json.encodeToString(encrypted)

        val envelopeLocation =
            if (request.location.isKnown) {
                val lat = requireNotNull(request.location.latitude)
                val lng = requireNotNull(request.location.longitude)
                Location(
                    latitude = roundCoordinate(lat),
                    longitude = roundCoordinate(lng),
                    accuracy = request.location.accuracyMeters?.let { coarseAccuracy(it) },
                )
            } else {
                null
            }

        val envelope =
            Envelope(
                timestamp = isoTimestamp,
                locationStatus = locationStatus,
                location = envelopeLocation,
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

    private fun innerV2Bytes(
        request: SosComposeRequest,
        sender: com.sosmesh.android.core.data.profile.SosSenderContext,
        isoTimestamp: String,
        innerLocation: SosInnerLocation?,
    ): ByteArray {
        var note = SosInnerV2Mapping.clampNote(request.note)
        while (true) {
            val v2 =
                SosInnerPayloadV2(
                    senderKey = sender.senderKey,
                    seq = sender.seq,
                    createdAt = isoTimestamp,
                    sosType = SosInnerV2Mapping.sosType(request.sosType),
                    note = note,
                    language = normalizeLanguage(request.languageTag),
                    location =
                        innerLocation?.let {
                            SosInnerLocationV2(it.latitude, it.longitude, it.accuracy_meters, it.timestamp)
                        },
                    personCount = request.personCount?.takeIf { it in 1..50 },
                    profile = sender.profile,
                    profileChanged = if (sender.profileChanged) true else null,
                )
            val bytes = innerV2Json.encodeToString(SosInnerPayloadV2.serializer(), v2).toByteArray(Charsets.UTF_8)
            if (bytes.size <= SosInnerV2Mapping.MAX_INNER_BYTES || note.isNullOrEmpty()) return bytes
            // §14 inner-oversize: never refuse, drop the note tail.
            note = note.dropLast(maxOf(1, bytes.size - SosInnerV2Mapping.MAX_INNER_BYTES)).ifEmpty { null }
        }
    }

    private fun locationStatusWire(location: LocationSnapshot): String =
        when (location.source) {
            LocationSource.UNKNOWN -> LocationStatus.UNKNOWN
            LocationSource.GPS -> LocationStatus.GPS
            LocationSource.MANUAL -> LocationStatus.MANUAL
        }

    private fun buildEnvelopeMap(
        location: LocationSnapshot,
        locationStatus: String,
        isoTimestamp: String,
    ): Map<String, Any?> {
        val locationMap: Map<String, Any?>? =
            if (location.isKnown) {
                val lat = requireNotNull(location.latitude)
                val lng = requireNotNull(location.longitude)
                val map =
                    linkedMapOf<String, Any?>(
                        "latitude" to roundCoordinate(lat),
                        "longitude" to roundCoordinate(lng),
                    )
                location.accuracyMeters?.let { map["accuracy"] = coarseAccuracy(it) }
                map
            } else {
                null
            }
        return mapOf(
            "timestamp" to isoTimestamp,
            "locationStatus" to locationStatus,
            "location" to locationMap,
            "priority" to 1,
        )
    }

    private fun roundCoordinate(coord: Double): Double {
        return (coord * 100.0).let { if (it.isFinite()) kotlin.math.round(it) / 100.0 else coord }
    }

    private fun coarseAccuracy(accuracyMeters: Double): Double {
        return maxOf(accuracyMeters, 1000.0)
    }

    private fun normalizeLanguage(tag: String): String =
        when {
            tag.lowercase().startsWith("tr") -> "tr"
            else -> "en"
        }

    companion object {
        private val innerV2Json =
            Json {
                encodeDefaults = true
                explicitNulls = false
            }

        private val canonicalJson =
            Json {
                prettyPrint = false
                encodeDefaults = true
                explicitNulls = true
                ignoreUnknownKeys = false
            }

        fun instantToIso8601(instant: Instant): String = DateTimeFormatter.ISO_INSTANT.format(instant)
    }
}

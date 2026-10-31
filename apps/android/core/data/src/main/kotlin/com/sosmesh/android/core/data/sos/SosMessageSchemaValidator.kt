package com.sosmesh.android.core.data.sos

import com.sosmesh.contracts.LocationStatus
import com.sosmesh.contracts.SosMessage
import java.util.UUID

object SosMessageSchemaValidator {
    private val uuidRegex =
        Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
    private val isoInstantRegex =
        Regex(
            "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?Z$",
        )
    private val allowedAckLevels =
        setOf(
            "DEVICE_STORED",
            "PEER_RECEIVED",
            "RELAY_FORWARDED",
            "SERVER_RECEIVED",
            "OPERATOR_VIEWED",
            "INCIDENT_OPENED",
        )
    private val allowedLocationStatuses =
        setOf(
            LocationStatus.UNKNOWN,
            LocationStatus.GPS,
            LocationStatus.MANUAL,
        )

    fun validate(message: SosMessage) {
        require(message.version == 1) { "version must be 1" }
        require(uuidRegex.matches(message.id)) { "id must be UUID" }
        require(isoInstantRegex.matches(message.envelope.timestamp)) { "timestamp must be ISO-8601 Z" }
        require(message.envelope.locationStatus in allowedLocationStatuses) { "invalid locationStatus" }

        when (message.envelope.locationStatus) {
            LocationStatus.UNKNOWN -> {
                require(message.envelope.location == null) {
                    "UNKNOWN locationStatus requires null envelope.location (not Null Island)"
                }
            }
            LocationStatus.GPS, LocationStatus.MANUAL -> {
                val loc =
                    requireNotNull(message.envelope.location) {
                        "GPS/MANUAL locationStatus requires envelope.location"
                    }
                require(loc.latitude in -90.0..90.0) { "latitude out of range" }
                require(loc.longitude in -180.0..180.0) { "longitude out of range" }
                loc.accuracy?.let { require(it >= 0) { "accuracy must be >= 0" } }
            }
            else -> error("invalid locationStatus")
        }

        require(message.envelope.priority in 1..5) { "priority out of range" }
        require(message.envelope.ackLevel in allowedAckLevels) { "invalid ackLevel" }
        message.envelope.relayCount?.let { require(it >= 0) { "relayCount must be >= 0" } }
        require(message.encryptedPayload.isNotEmpty()) { "encryptedPayload required" }
        UUID.fromString(message.id)
    }
}

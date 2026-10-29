package com.sosmesh.contracts

import kotlinx.serialization.Serializable

@Serializable
data class Location(
    val latitude: Double,
    val longitude: Double,
    val accuracy: Double? = null
)

@Serializable
data class Envelope(
    val timestamp: String,
    val location: Location,
    val priority: Int,
    val ackLevel: String,
    val relayCount: Int? = null
)

@Serializable
data class SosMessage(
    val version: Int,
    val id: String,
    val envelope: Envelope,
    val encryptedPayload: String,
    val signature: String? = null
)

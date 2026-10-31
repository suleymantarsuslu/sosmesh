package com.sosmesh.android.core.data.sos

import kotlinx.serialization.Serializable

@Serializable
data class SosInnerPayload(
    val sos_type: String,
    val person_count: Int? = null,
    val note: String? = null,
    val location: SosInnerLocation? = null,
    val language: String,
)

@Serializable
data class SosInnerLocation(
    val latitude: Double,
    val longitude: Double,
    val accuracy_meters: Double? = null,
    val timestamp: String,
)

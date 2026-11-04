package com.sosmesh.android.core.data.profile

import kotlinx.serialization.Serializable

/** mesh-v2 §7 / SosInnerPayloadV2.profile. All fields optional. Never logged, never sent outside an SOS. */
@Serializable
data class SosProfile(
    val fullName: String? = null,
    val age: Int? = null,
    val address: SosProfileAddress? = null,
    val floor: Int? = null,
    val homeLocation: SosProfileLatLng? = null,
    val phone: String? = null,
    val email: String? = null,
    val householdSize: Int? = null,
) {
    fun isEmpty(): Boolean = this == SosProfile() || this == SosProfile(address = SosProfileAddress())

    /** Clamp to schema limits so a bad field never blocks an SOS. */
    fun sanitized(): SosProfile =
        SosProfile(
            fullName = fullName?.trim()?.take(100)?.ifEmpty { null },
            age = age?.takeIf { it in 0..130 },
            address = address?.sanitized()?.takeIf { it != SosProfileAddress() },
            floor = floor?.takeIf { it in -10..200 },
            homeLocation = homeLocation?.takeIf { it.latitude in -90.0..90.0 && it.longitude in -180.0..180.0 },
            phone = phone?.replace(" ", "")?.takeIf { PHONE.matches(it) },
            email = email?.trim()?.take(254)?.takeIf { it.contains('@') },
            householdSize = householdSize?.takeIf { it in 1..50 },
        )

    companion object {
        private val PHONE = Regex("^\\+[1-9][0-9]{6,14}$")
    }
}

@Serializable
data class SosProfileAddress(
    val line: String? = null,
    val district: String? = null,
    val city: String? = null,
    val postalCode: String? = null,
    val country: String? = null,
) {
    fun sanitized(): SosProfileAddress =
        SosProfileAddress(
            line = line?.trim()?.take(300)?.ifEmpty { null },
            district = district?.trim()?.take(80)?.ifEmpty { null },
            city = city?.trim()?.take(80)?.ifEmpty { null },
            postalCode = postalCode?.trim()?.take(16)?.ifEmpty { null },
            country = country?.trim()?.uppercase()?.takeIf { Regex("^[A-Z]{2}$").matches(it) },
        )

    fun geocodeQuery(): String? = listOfNotNull(line, district, city, postalCode, country).joinToString(", ").ifEmpty { null }
}

@Serializable
data class SosProfileLatLng(val latitude: Double, val longitude: Double)

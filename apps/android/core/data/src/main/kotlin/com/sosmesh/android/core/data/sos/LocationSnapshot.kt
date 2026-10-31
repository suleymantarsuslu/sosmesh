package com.sosmesh.android.core.data.sos

data class LocationSnapshot(
    val latitude: Double,
    val longitude: Double,
    val accuracyMeters: Double?,
    val isKnown: Boolean,
) {
    companion object {
        /** Synthetic placeholder when GPS unavailable (fixtures / privacy). */
        fun unknown(): LocationSnapshot =
            LocationSnapshot(
                latitude = 0.0,
                longitude = 0.0,
                accuracyMeters = null,
                isKnown = false,
            )
    }
}

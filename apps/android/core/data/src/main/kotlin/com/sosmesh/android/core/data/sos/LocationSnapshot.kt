package com.sosmesh.android.core.data.sos

enum class LocationSource {
    UNKNOWN,
    GPS,
    MANUAL,
}

data class LocationSnapshot(
    val source: LocationSource,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val accuracyMeters: Double? = null,
) {
    val isKnown: Boolean
        get() = source != LocationSource.UNKNOWN

    companion object {
        fun unknown(): LocationSnapshot =
            LocationSnapshot(
                source = LocationSource.UNKNOWN,
                latitude = null,
                longitude = null,
                accuracyMeters = null,
            )

        fun gps(
            latitude: Double,
            longitude: Double,
            accuracyMeters: Double? = null,
        ): LocationSnapshot =
            LocationSnapshot(
                source = LocationSource.GPS,
                latitude = latitude,
                longitude = longitude,
                accuracyMeters = accuracyMeters,
            )

        fun manual(
            latitude: Double,
            longitude: Double,
        ): LocationSnapshot =
            LocationSnapshot(
                source = LocationSource.MANUAL,
                latitude = latitude,
                longitude = longitude,
                accuracyMeters = null,
            )
    }
}

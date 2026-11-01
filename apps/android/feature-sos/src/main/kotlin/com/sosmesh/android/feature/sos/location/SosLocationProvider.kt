package com.sosmesh.android.feature.sos.location

import com.sosmesh.android.core.data.sos.LocationSnapshot

interface SosLocationProvider {
    fun currentLocation(): LocationSnapshot
}

class DefaultSosLocationProvider(
    private val hasLocationPermission: () -> Boolean,
    private val gpsSnapshot: () -> LocationSnapshot?,
) : SosLocationProvider {
    override fun currentLocation(): LocationSnapshot {
        if (!hasLocationPermission()) {
            return LocationSnapshot.unknown()
        }
        return gpsSnapshot() ?: LocationSnapshot.unknown()
    }
}

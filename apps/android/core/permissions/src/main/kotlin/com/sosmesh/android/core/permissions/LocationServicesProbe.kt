package com.sosmesh.android.core.permissions

/** Platform hook for legacy BLE scan location-services requirement. */
interface LocationServicesProbe {
    fun locationServicesAvailable(): Boolean
}

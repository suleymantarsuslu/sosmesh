package com.sosmesh.android.core.ble.android

import android.content.Context
import android.location.LocationManager
import com.sosmesh.android.core.ble.platform.LocationServicesPort
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AndroidLocationServicesPort
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) : LocationServicesPort {
        override fun isEnabledForBleScan(): Boolean {
            val locationManager =
                context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
                    ?: return false
            return locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
        }
    }

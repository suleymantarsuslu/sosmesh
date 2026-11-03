package com.sosmesh.android.feature.sos.location

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.sosmesh.android.core.data.sos.LocationSnapshot
import kotlinx.coroutines.CancellableContinuation
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import java.util.concurrent.Executor
import kotlin.coroutines.resume

class AndroidGpsLocationProvider(
    private val context: Context,
) : SosLocationProvider {
    private val locationManager: LocationManager by lazy {
        context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    }

    override fun currentLocation(): LocationSnapshot {
        return if (hasLocationPermission()) {
            getLastKnownLocationSync()
        } else {
            LocationSnapshot.unknown()
        }
    }

    suspend fun requestLocationAsync(timeoutMs: Long = 5000): LocationSnapshot {
        if (!hasLocationPermission()) {
            return LocationSnapshot.unknown()
        }

        val freshLocation = withTimeoutOrNull(timeoutMs) {
            if (Build.VERSION.SDK_INT >= 30) {
                getCurrentLocationApi30()
            } else {
                null
            }
        }

        return freshLocation ?: getLastKnownLocationSync()
    }

    private fun hasLocationPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_COARSE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
    }

    private fun getLastKnownLocationSync(): LocationSnapshot {
        try {
            val providers = locationManager.getProviders(true)
            var bestLocation: Location? = null
            var bestAccuracy = Float.MAX_VALUE

            for (provider in providers) {
                val location = locationManager.getLastKnownLocation(provider) ?: continue
                if (location.accuracy < bestAccuracy) {
                    bestLocation = location
                    bestAccuracy = location.accuracy
                }
            }

            return bestLocation?.let {
                LocationSnapshot.gps(
                    latitude = it.latitude,
                    longitude = it.longitude,
                    accuracyMeters = it.accuracy.toDouble(),
                    capturedAtMs = it.time
                )
            } ?: LocationSnapshot.unknown()
        } catch (e: SecurityException) {
            return LocationSnapshot.unknown()
        }
    }

    @androidx.annotation.RequiresApi(30)
    private suspend fun getCurrentLocationApi30(): LocationSnapshot? = suspendCancellableCoroutine { continuation ->
        try {
            val provider = LocationManager.GPS_PROVIDER
            if (!locationManager.isProviderEnabled(provider)) {
                continuation.resume(null)
                return@suspendCancellableCoroutine
            }

            locationManager.getCurrentLocation(
                provider,
                null,
                DirectExecutor,
                LocationConsumer(continuation)
            )

            continuation.invokeOnCancellation {
            }
        } catch (e: SecurityException) {
            continuation.resume(null)
        } catch (e: Exception) {
            continuation.resume(null)
        }
    }

    private object DirectExecutor : Executor {
        override fun execute(command: Runnable) {
            command.run()
        }
    }

    private class LocationConsumer(
        private val continuation: CancellableContinuation<LocationSnapshot?>
    ) : java.util.function.Consumer<Location?> {
        override fun accept(location: Location?) {
            if (continuation.isActive) {
                continuation.resume(
                    location?.let {
                        LocationSnapshot.gps(
                            latitude = it.latitude,
                            longitude = it.longitude,
                            accuracyMeters = it.accuracy.toDouble(),
                            capturedAtMs = it.time
                        )
                    }
                )
            }
        }
    }
}

package com.sosmesh.android.core.data.broadcast

import android.content.Context
import android.location.Location
import android.location.LocationManager
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BroadcastPoller
    @Inject
    constructor(
        private val context: Context,
        private val repository: BroadcastRepository,
        private val notificationManager: BroadcastNotificationManager,
    ) : DefaultLifecycleObserver {
        private val scope = CoroutineScope(Dispatchers.Main + Job())
        private var pollingJob: Job? = null
        private var isStarted = false

        fun start() {
            if (isStarted) return
            isStarted = true
            ProcessLifecycleOwner.get().lifecycle.addObserver(this)
        }

        override fun onStart(owner: LifecycleOwner) {
            super.onStart(owner)
            startPolling()
            fetchImmediately()
        }

        override fun onStop(owner: LifecycleOwner) {
            super.onStop(owner)
            stopPolling()
        }

        private fun startPolling() {
            if (pollingJob?.isActive == true) return

            pollingJob =
                scope.launch {
                    while (isActive) {
                        delay(20_000)
                        if (isActive) {
                            fetchAndProcess()
                        }
                    }
                }
        }

        private fun stopPolling() {
            pollingJob?.cancel()
            pollingJob = null
        }

        private fun fetchImmediately() {
            scope.launch {
                fetchAndProcess()
            }
        }

        suspend fun fetchAndProcess() {
            withContext(Dispatchers.IO) {
                try {
                    val runtime = com.sosmesh.android.meshv2.v2.MeshV2Runtime.installed
                    val location = getLastKnownLocation()
                    val broadcasts = repository.fetchAndProcessBroadcasts(location)
                    val nowMs = System.currentTimeMillis()

                    broadcasts.forEach { broadcast ->
                        try {
                            notificationManager.showNotification(broadcast)
                        } catch (_: SecurityException) {
                        }

                        runtime?.node?.broadcasts?.put(
                            com.sosmesh.android.meshv2.v2.ServerBroadcast(
                                id = broadcast.id,
                                title = broadcast.title,
                                body = broadcast.body,
                                severity = broadcast.severity,
                                createdAt = broadcast.createdAt,
                                expiresAt = broadcast.expiresAt,
                                regionLat = broadcast.regionLat,
                                regionLng = broadcast.regionLng,
                                regionRadiusKm = broadcast.regionRadiusKm,
                                signature = broadcast.signature,
                                hopsLeft = 8,
                            ),
                            nowMs,
                        )
                    }
                } catch (_: Exception) {
                }
            }
        }

        private fun getLastKnownLocation(): Location? {
            return try {
                val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
                locationManager?.getLastKnownLocation(LocationManager.PASSIVE_PROVIDER)
            } catch (e: SecurityException) {
                null
            }
        }
    }

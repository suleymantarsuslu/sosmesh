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
                    val location = getLastKnownLocation()
                    val broadcasts = repository.fetchAndProcessBroadcasts(location)
                    val nowMs = System.currentTimeMillis()

                    broadcasts.forEach { broadcast ->
                        try {
                            notificationManager.showNotification(broadcast)
                        } catch (_: SecurityException) {
                        }

                        meshSink?.invoke(broadcast, nowMs)
                    }
                } catch (_: Exception) {
                }
            }
        }

        companion object {
            /** Set by the app module to hand verified broadcasts to the mesh relay (core:data can't depend on mesh-v2). */
            @Volatile
            var meshSink: ((ServerBroadcast, Long) -> Unit)? = null
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

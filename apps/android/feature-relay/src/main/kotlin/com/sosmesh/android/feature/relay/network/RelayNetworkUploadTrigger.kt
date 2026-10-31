package com.sosmesh.android.feature.relay.network

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import com.sosmesh.android.feature.relay.upload.RelayUploadCommands
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Schedules relay upload when validated internet becomes available again.
 */
@Singleton
class RelayNetworkUploadTrigger
    @Inject
    constructor(
        @ApplicationContext context: Context,
        uploadScheduler: RelayUploadCommands,
    ) {
        init {
            val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            cm.registerDefaultNetworkCallback(
                object : ConnectivityManager.NetworkCallback() {
                    override fun onAvailable(network: Network) {
                        val caps = cm.getNetworkCapabilities(network) ?: return
                        if (!caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) {
                            return
                        }
                        if (!caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)) {
                            return
                        }
                        uploadScheduler.scheduleUpload(System.currentTimeMillis())
                    }
                },
            )
        }
    }

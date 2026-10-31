package com.sosmesh.android.relay

import android.content.Context
import android.content.Intent
import com.sosmesh.android.feature.relay.session.RelayForegroundLauncher
import com.sosmesh.android.service.MeshConnectionForegroundService
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AppRelayForegroundLauncher
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) : RelayForegroundLauncher {
        override fun startForegroundRelay() {
            val intent = Intent(context, MeshConnectionForegroundService::class.java)
            intent.action = MeshConnectionForegroundService.ACTION_START
            context.startForegroundService(intent)
        }

        override fun stopForegroundRelay() {
            val intent = Intent(context, MeshConnectionForegroundService::class.java)
            intent.action = MeshConnectionForegroundService.ACTION_STOP
            context.startService(intent)
        }
    }

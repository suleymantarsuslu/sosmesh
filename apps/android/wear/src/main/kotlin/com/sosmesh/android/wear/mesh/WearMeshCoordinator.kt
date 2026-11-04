package com.sosmesh.android.wear.mesh

import android.content.Context
import android.content.Intent

class WearMeshCoordinator(
    private val context: Context,
) {
    private var relayActive = false

    fun startRelay() {
        if (!relayActive) {
            val intent =
                Intent(context, WearMeshForegroundService::class.java).apply {
                    action = WearMeshForegroundService.ACTION_START
                }
            context.startForegroundService(intent)
            relayActive = true
        }
    }

    fun stopRelay() {
        if (relayActive) {
            val intent =
                Intent(context, WearMeshForegroundService::class.java).apply {
                    action = WearMeshForegroundService.ACTION_STOP
                }
            context.startService(intent)
            relayActive = false
        }
    }

    fun isRelayActive(): Boolean = relayActive
}

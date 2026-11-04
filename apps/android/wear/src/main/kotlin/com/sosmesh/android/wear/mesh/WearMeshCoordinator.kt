package com.sosmesh.android.wear.mesh

import android.content.Context
import android.content.Intent
import com.sosmesh.android.core.ble.BleMeshRadio
import com.sosmesh.android.meshv2.v2.MeshV2Runtime
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class WearMeshCoordinator
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
        private val meshRuntime: MeshV2Runtime,
        private val bleMeshRadio: BleMeshRadio,
    ) {
        private var relayActive = false

        fun startRelay(): Result<Unit> {
            if (relayActive) return Result.success(Unit)
            
            meshRuntime.node.relayEnabled = true
            val radioResult = bleMeshRadio.startPeerDiscovery(foregroundVisible = false)
            if (radioResult.isFailure) {
                meshRuntime.node.relayEnabled = false
                return radioResult
            }
            
            val intent =
                Intent(context, WearMeshForegroundService::class.java).apply {
                    action = WearMeshForegroundService.ACTION_START
                }
            context.startForegroundService(intent)
            relayActive = true
            return Result.success(Unit)
        }

        fun stopRelay() {
            if (!relayActive) return
            
            meshRuntime.node.relayEnabled = false
            bleMeshRadio.stopPeerDiscovery()
            
            val intent =
                Intent(context, WearMeshForegroundService::class.java).apply {
                    action = WearMeshForegroundService.ACTION_STOP
                }
            context.startService(intent)
            relayActive = false
        }

        fun isRelayActive(): Boolean = relayActive

        fun getMissingPermissions(): List<String> = emptyList()
    }

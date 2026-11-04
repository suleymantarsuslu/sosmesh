package com.sosmesh.android

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import com.sosmesh.android.crash.LocalCrashReporter
import com.sosmesh.android.locale.AppLocaleController
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class SosMeshApplication : Application(), Configuration.Provider {
    @Inject
    lateinit var workerFactory: HiltWorkerFactory

    @Inject
    lateinit var crashReporter: LocalCrashReporter

    @Inject
    lateinit var meshV2Runtime: com.sosmesh.android.meshv2.v2.MeshV2Runtime

    @Inject
    lateinit var meshV2OutboxSync: com.sosmesh.android.feature.relay.mesh.MeshV2OutboxSync

    @Inject
    lateinit var broadcastDialogCoordinator: com.sosmesh.android.broadcast.BroadcastDialogCoordinator

    @Inject
    lateinit var relayDeliveryTracker: com.sosmesh.android.feature.relay.mesh.RelayDeliveryTracker

    override fun onCreate() {
        super.onCreate()
        AppLocaleController.applyStoredLocale(this)
        crashReporter.install()
        meshV2Runtime.install(filesDir)
        meshV2OutboxSync.start()
        relayDeliveryTracker.start()
        com.sosmesh.android.core.data.broadcast.BroadcastPoller.foregroundDialogHandler = { broadcast ->
            broadcastDialogCoordinator.showRelayRequestDialog(
                id = broadcast.id,
                title = broadcast.title,
                body = broadcast.body,
            )
        }
        com.sosmesh.android.core.data.broadcast.BroadcastPoller.meshSink = { broadcast, nowMs ->
            com.sosmesh.android.meshv2.v2.MeshV2Runtime.installed?.node?.broadcasts?.put(
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
        com.sosmesh.android.core.data.broadcast.BroadcastFetchWorker.schedule(this)
        initializeFirebase()
    }

    private fun initializeFirebase() {
        val projectId = null
        val applicationId = null
        val apiKey = null
        com.sosmesh.android.core.data.broadcast.FirebaseInitializer.initialize(
            this,
            projectId,
            applicationId,
            apiKey,
        )
    }

    override val workManagerConfiguration: Configuration
        get() =
            Configuration.Builder()
                .setWorkerFactory(workerFactory)
                .build()
}

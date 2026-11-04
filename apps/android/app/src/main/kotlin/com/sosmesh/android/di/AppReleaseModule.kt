package com.sosmesh.android.di

import android.content.Context
import com.sosmesh.android.BuildConfig
import com.sosmesh.android.crash.LocalCrashReporter
import com.sosmesh.android.crash.RedactedLocalCrashReporter
import com.sosmesh.android.feature.relay.uplink.RelayIdentityProvider
import com.sosmesh.android.feature.relay.uplink.RelayIngestConfig
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class AppReleaseModule {
    @Binds
    @Singleton
    abstract fun bindLocalCrashReporter(impl: RedactedLocalCrashReporter): LocalCrashReporter

    companion object {
        @Provides
        @Singleton
        fun provideMeshV2Config(
            config: RelayIngestConfig,
            @ApplicationContext context: Context,
            @com.sosmesh.android.core.data.di.BroadcastPublicKey publicKeyBase64: String,
        ): com.sosmesh.android.meshv2.v2.MeshV2Config {
            val verifier = com.sosmesh.android.core.data.broadcast.BroadcastSignatureVerifier(publicKeyBase64)
            val notificationManager = com.sosmesh.android.core.data.broadcast.BroadcastNotificationManager(context)
            
            return com.sosmesh.android.meshv2.v2.MeshV2Config(
                relayIdHex = config.relayIdHex,
                receiptVerifyPublicKeySpkiBase64 = config.receiptVerifyPublicKeySpkiBase64,
                broadcastVerifier = { broadcast ->
                    verifier.verify(
                        com.sosmesh.android.core.data.broadcast.ServerBroadcast(
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
                        )
                    )
                },
                broadcastNotifier = { broadcast ->
                    notificationManager.showNotification(
                        com.sosmesh.android.core.data.broadcast.ServerBroadcast(
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
                        )
                    )
                },
                locationProvider = {
                    try {
                        val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? android.location.LocationManager
                        val location = locationManager?.getLastKnownLocation(android.location.LocationManager.PASSIVE_PROVIDER)
                        if (location != null) {
                            Pair(location.latitude, location.longitude)
                        } else {
                            null
                        }
                    } catch (e: SecurityException) {
                        null
                    }
                },
            )
        }

        @Provides
        @Singleton
        fun provideRelayIngestConfig(identity: RelayIdentityProvider): RelayIngestConfig {
            val base = BuildConfig.INGEST_BASE_URL.trimEnd('/')
            return RelayIngestConfig(
                ingestUrl = base + RelayIngestConfig.DEFAULT_INGEST_PATH,
                receiptVerifyPublicKeySpkiBase64 = RelayIngestConfig.PROD_RECEIPT_PUBLIC_KEY,
                relayIdHex = identity.relayIdHex,
                requireHttps = BuildConfig.REQUIRE_HTTPS_INGEST,
            )
        }

        @Provides
        @com.sosmesh.android.core.data.di.ApiBaseUrl
        fun provideApiBaseUrl(): String = BuildConfig.INGEST_BASE_URL.trimEnd('/')

        @Provides
        @com.sosmesh.android.core.data.di.BroadcastPublicKey
        fun provideBroadcastPublicKey(): String = BuildConfig.BROADCAST_PUBLIC_KEY
    }
}

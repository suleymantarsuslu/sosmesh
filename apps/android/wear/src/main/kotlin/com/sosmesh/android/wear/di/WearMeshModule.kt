package com.sosmesh.android.wear.di

import android.content.Context
import com.sosmesh.android.feature.relay.uplink.RelayIngestConfig
import com.sosmesh.android.meshv2.v2.MeshV2Config
import com.sosmesh.android.wear.BuildConfig
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Qualifier
import javax.inject.Singleton

@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class BroadcastPublicKey

@Module
@InstallIn(SingletonComponent::class)
object WearMeshModule {
    @Provides
    @Singleton
    fun provideMeshV2Config(
        @WearRelayIdHex relayIdHex: String,
        @BroadcastPublicKey publicKeyBase64: String,
        @ApplicationContext context: Context,
    ): MeshV2Config {
        val verifier = com.sosmesh.android.core.data.broadcast.BroadcastSignatureVerifier(publicKeyBase64)
        
        return MeshV2Config(
            relayIdHex = relayIdHex,
            receiptVerifyPublicKeySpkiBase64 = RelayIngestConfig.PROD_RECEIPT_PUBLIC_KEY,
            isWatch = true,
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
            broadcastNotifier = null,
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
    @BroadcastPublicKey
    fun provideBroadcastPublicKey(): String = BuildConfig.BROADCAST_PUBLIC_KEY
}

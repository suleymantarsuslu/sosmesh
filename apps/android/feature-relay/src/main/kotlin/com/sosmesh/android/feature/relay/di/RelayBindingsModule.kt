package com.sosmesh.android.feature.relay.di

import com.sosmesh.android.feature.relay.uplink.DeferredRelayIngestUplink
import com.sosmesh.android.feature.relay.uplink.RelayIngestConfig
import com.sosmesh.android.feature.relay.uplink.RelayIngestUplink
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object RelayBindingsModule {
    @Provides
    @Singleton
    fun provideRelayIngestConfig(): RelayIngestConfig = RelayIngestConfig.default()

    @Provides
    @Singleton
    fun provideRelayIngestUplink(deferred: DeferredRelayIngestUplink): RelayIngestUplink = deferred
}

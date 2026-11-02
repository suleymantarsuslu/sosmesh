package com.sosmesh.android.feature.relay.di

import com.sosmesh.android.feature.relay.uplink.HttpRelayIngestUplink
import com.sosmesh.android.feature.relay.uplink.RelayIngestUplink
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class RelayBindingsModule {
    @Binds
    @Singleton
    abstract fun bindRelayIngestUplink(impl: HttpRelayIngestUplink): RelayIngestUplink
}

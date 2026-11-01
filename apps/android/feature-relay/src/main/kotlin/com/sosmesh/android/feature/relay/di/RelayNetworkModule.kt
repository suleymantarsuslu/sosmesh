package com.sosmesh.android.feature.relay.di

import com.sosmesh.android.feature.relay.network.AndroidRelayNetworkStatus
import com.sosmesh.android.feature.relay.network.RelayNetworkStatus
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class RelayNetworkModule {
    @Binds
    @Singleton
    abstract fun bindRelayNetworkStatus(impl: AndroidRelayNetworkStatus): RelayNetworkStatus
}

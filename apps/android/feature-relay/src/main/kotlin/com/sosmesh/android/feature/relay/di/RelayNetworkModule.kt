package com.sosmesh.android.feature.relay.di

import com.sosmesh.android.feature.relay.network.AndroidRelayNetworkStatus
import com.sosmesh.android.feature.relay.network.RelayNetworkStatus
import com.sosmesh.android.feature.relay.network.RelayNetworkUploadTrigger
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class RelayNetworkModule {
    @Binds
    @Singleton
    abstract fun bindRelayNetworkStatus(impl: AndroidRelayNetworkStatus): RelayNetworkStatus

    companion object {
        @Provides
        @Singleton
        fun bootstrapNetworkUploadTrigger(trigger: RelayNetworkUploadTrigger): RelayNetworkUploadTrigger = trigger
    }
}

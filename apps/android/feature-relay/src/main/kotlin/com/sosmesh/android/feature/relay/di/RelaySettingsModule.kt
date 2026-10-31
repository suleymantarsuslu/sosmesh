package com.sosmesh.android.feature.relay.di

import com.sosmesh.android.feature.relay.settings.RelaySettingsPort
import com.sosmesh.android.feature.relay.settings.RelaySettingsStore
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class RelaySettingsModule {
    @Binds
    @Singleton
    abstract fun bindRelaySettingsPort(store: RelaySettingsStore): RelaySettingsPort
}

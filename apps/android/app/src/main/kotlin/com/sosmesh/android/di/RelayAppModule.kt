package com.sosmesh.android.di

import com.sosmesh.android.feature.relay.session.RelayForegroundLauncher
import com.sosmesh.android.relay.AppRelayForegroundLauncher
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class RelayAppModule {
    @Binds
    @Singleton
    abstract fun bindRelayForegroundLauncher(impl: AppRelayForegroundLauncher): RelayForegroundLauncher
}

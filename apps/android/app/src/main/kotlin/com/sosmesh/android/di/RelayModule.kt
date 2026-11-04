package com.sosmesh.android.di

import com.sosmesh.android.core.data.relay.RelayController
import com.sosmesh.android.feature.relay.settings.RelaySettingsStore
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RelayControllerImpl
    @Inject
    constructor(
        private val settingsStore: RelaySettingsStore,
    ) : RelayController {
        override fun setRelayEnabled(enabled: Boolean) {
            settingsStore.setRelayEnabled(enabled)
        }
    }

@Module
@InstallIn(SingletonComponent::class)
abstract class RelayModule {
    @Binds
    @Singleton
    abstract fun bindRelayController(impl: RelayControllerImpl): RelayController
}

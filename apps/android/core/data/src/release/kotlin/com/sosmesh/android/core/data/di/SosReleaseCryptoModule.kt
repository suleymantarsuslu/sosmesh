package com.sosmesh.android.core.data.di

import com.sosmesh.contracts.CryptoConfig
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object SosReleaseCryptoModule {
    @Provides
    @Singleton
    fun provideCryptoConfig(): CryptoConfig {
        error(
            "Release SOS encryption is not configured: production CryptoConfig must be wired " +
                "before shipping; dev-test keys are excluded from release builds.",
        )
    }
}

package com.sosmesh.android.core.data.di

import com.sosmesh.android.core.data.sos.SosMessageComposer
import com.sosmesh.contracts.CryptoConfig
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object SosModule {
    @Provides
    @Singleton
    fun provideSosMessageComposer(config: CryptoConfig): SosMessageComposer = SosMessageComposer(config)
}

package com.sosmesh.android.wear.di

import com.sosmesh.contracts.CryptoConfig
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object WearCryptoModule {
    private const val PROD_KEY_ID = "prod-2026-11-a"
    private const val PROD_SERVER_PUBLIC_KEY = "njCfeyVCrZmw9xdi9g1sVHBxtDouBDVYq4wJbNO6YnQ="

    @Provides
    @Singleton
    fun provideCryptoConfig(): CryptoConfig =
        CryptoConfig(
            keyId = PROD_KEY_ID,
            serverPublicKey = PROD_SERVER_PUBLIC_KEY,
        )
}

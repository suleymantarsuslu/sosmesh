package com.sosmesh.android.di

import com.sosmesh.android.BuildConfig
import com.sosmesh.android.crash.LocalCrashReporter
import com.sosmesh.android.crash.RedactedLocalCrashReporter
import com.sosmesh.android.feature.relay.uplink.RelayIdentityProvider
import com.sosmesh.android.feature.relay.uplink.RelayIngestConfig
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class AppReleaseModule {
    @Binds
    @Singleton
    abstract fun bindLocalCrashReporter(impl: RedactedLocalCrashReporter): LocalCrashReporter

    companion object {
        @Provides
        @Singleton
        fun provideRelayIngestConfig(identity: RelayIdentityProvider): RelayIngestConfig {
            val base = BuildConfig.INGEST_BASE_URL.trimEnd('/')
            return RelayIngestConfig(
                ingestUrl = base + RelayIngestConfig.DEFAULT_INGEST_PATH,
                receiptVerifyPublicKeySpkiBase64 = RelayIngestConfig.PROD_RECEIPT_PUBLIC_KEY_PLACEHOLDER,
                relayIdHex = identity.relayIdHex,
                requireHttps = BuildConfig.REQUIRE_HTTPS_INGEST,
            )
        }
    }
}

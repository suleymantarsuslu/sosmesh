package com.sosmesh.android.feature.relay.di

import com.sosmesh.android.core.data.outbox.OutboxUploadScheduler
import com.sosmesh.android.feature.relay.upload.RelayUploadCommands
import com.sosmesh.android.feature.relay.upload.RelayUploadScheduler
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class RelayUploadModule {
    @Binds
    @Singleton
    abstract fun bindRelayUploadCommands(impl: RelayUploadScheduler): RelayUploadCommands

    @Binds
    @Singleton
    abstract fun bindOutboxUploadScheduler(impl: RelayUploadScheduler): OutboxUploadScheduler
}

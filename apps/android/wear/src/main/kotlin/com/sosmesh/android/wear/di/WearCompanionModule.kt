package com.sosmesh.android.wear.di

import android.content.Context
import com.sosmesh.android.core.wear.companion.queue.InMemoryWearOfflineQueueStore
import com.sosmesh.android.core.wear.companion.queue.WearOfflineQueueStore
import com.sosmesh.android.core.wear.companion.transport.WearCompanionTransport
import com.sosmesh.android.core.wear.companion.watch.WearSosCoordinator
import com.sosmesh.android.wear.companion.GmsWearCompanionTransport
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object WearCompanionModule {
    @Provides
    @Singleton
    fun provideWearOfflineQueueStore(): WearOfflineQueueStore = InMemoryWearOfflineQueueStore()

    @Provides
    @Singleton
    fun provideWearCompanionTransport(
        @ApplicationContext context: Context,
    ): WearCompanionTransport = GmsWearCompanionTransport(context)

    @Provides
    @Singleton
    fun provideWearSosCoordinator(
        store: WearOfflineQueueStore,
        transport: WearCompanionTransport,
    ): WearSosCoordinator = WearSosCoordinator(store, transport)
}

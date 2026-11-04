package com.sosmesh.android.core.data.di

import android.content.Context
import com.sosmesh.android.core.data.broadcast.BroadcastNotificationManager
import com.sosmesh.android.core.data.broadcast.BroadcastRepository
import com.sosmesh.android.core.data.broadcast.BroadcastStore
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object BroadcastModule {
    @Provides
    @Singleton
    fun provideOkHttpClient(): OkHttpClient = OkHttpClient.Builder().build()

    @Provides
    @Singleton
    fun provideBroadcastStore(
        @ApplicationContext context: Context
    ): BroadcastStore = BroadcastStore(context)

    @Provides
    @Singleton
    fun provideBroadcastRepository(
        @ApplicationContext context: Context,
        httpClient: OkHttpClient,
        @ApiBaseUrl apiBaseUrl: String,
        @BroadcastPublicKey publicKeyBase64: String,
    ): BroadcastRepository = BroadcastRepository(
        context = context,
        httpClient = httpClient,
        apiBaseUrl = apiBaseUrl,
        publicKeyBase64 = publicKeyBase64,
    )

    @Provides
    @Singleton
    fun provideBroadcastNotificationManager(
        @ApplicationContext context: Context,
    ): BroadcastNotificationManager = BroadcastNotificationManager(context)

    @Provides
    @Singleton
    fun providePushTokenManager(
        @ApplicationContext context: Context,
        httpClient: OkHttpClient,
        @ApiBaseUrl apiBaseUrl: String,
    ): com.sosmesh.android.core.data.broadcast.PushTokenManager =
        com.sosmesh.android.core.data.broadcast.PushTokenManager(
            context = context,
            httpClient = httpClient,
            apiBaseUrl = apiBaseUrl,
        )

    @Provides
    @Singleton
    fun provideBroadcastPoller(
        @ApplicationContext context: Context,
        repository: BroadcastRepository,
        notificationManager: BroadcastNotificationManager,
    ): com.sosmesh.android.core.data.broadcast.BroadcastPoller =
        com.sosmesh.android.core.data.broadcast.BroadcastPoller(
            context = context,
            repository = repository,
            notificationManager = notificationManager,
        )

}

@javax.inject.Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class ApiBaseUrl

@javax.inject.Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class BroadcastPublicKey

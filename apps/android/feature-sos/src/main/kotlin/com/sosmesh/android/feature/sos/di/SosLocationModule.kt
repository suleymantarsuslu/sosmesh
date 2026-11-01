package com.sosmesh.android.feature.sos.di

import com.sosmesh.android.feature.sos.location.DefaultSosLocationProvider
import com.sosmesh.android.feature.sos.location.SosLocationProvider
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object SosLocationModule {
    @Provides
    @Singleton
    fun provideSosLocationProvider(): SosLocationProvider =
        DefaultSosLocationProvider(
            hasLocationPermission = { false },
            gpsSnapshot = { null },
        )
}

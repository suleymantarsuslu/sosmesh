package com.sosmesh.android.feature.sos.di

import android.content.Context
import com.sosmesh.android.feature.sos.location.AndroidGpsLocationProvider
import com.sosmesh.android.feature.sos.location.SosLocationProvider
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton
    
@Module
@InstallIn(SingletonComponent::class)
object SosLocationModule {
    @Provides
    @Singleton
    fun provideSosLocationProvider(
        @ApplicationContext context: Context
    ): SosLocationProvider = AndroidGpsLocationProvider(context)
}

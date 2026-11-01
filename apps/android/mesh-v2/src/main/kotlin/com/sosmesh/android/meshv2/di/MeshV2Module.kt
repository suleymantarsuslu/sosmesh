package com.sosmesh.android.meshv2.di

import com.sosmesh.android.meshv2.MeshForwardQueue
import com.sosmesh.android.meshv2.MeshRouteSelector
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object MeshV2Module {
    @Provides
    @Singleton
    fun provideForwardQueue(): MeshForwardQueue = MeshForwardQueue(maxDepth = 32)

    @Provides
    @Singleton
    fun provideRouteSelector(): MeshRouteSelector = MeshRouteSelector()
}

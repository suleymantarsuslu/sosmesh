package com.sosmesh.android.di

import com.sosmesh.android.core.data.mesh.SosPeerDeliveryPort
import com.sosmesh.android.mesh.AppSosPeerDeliveryPort
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class MeshDeliveryModule {
    @Binds
    @Singleton
    abstract fun bindSosPeerDeliveryPort(impl: AppSosPeerDeliveryPort): SosPeerDeliveryPort
}

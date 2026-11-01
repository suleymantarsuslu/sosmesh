package com.sosmesh.android.platform

import com.sosmesh.android.core.ble.platform.BluetoothAdapterPort
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object MeshPlatformModule {
    @Provides
    @Singleton
    fun provideBluetoothEnabledProbe(adapterPort: BluetoothAdapterPort): () -> Boolean = { adapterPort.isEnabled() }
}

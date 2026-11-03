package com.sosmesh.android.di

import com.sosmesh.android.core.permissions.BluetoothEnabledProbe
import com.sosmesh.android.core.permissions.LocationServicesProbe
import com.sosmesh.android.platform.MeshPlatformSignalBridge
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object LocationServicesModule {
    @Provides
    @Singleton
    fun provideLocationServicesProbe(bridge: MeshPlatformSignalBridge): LocationServicesProbe =
        object : LocationServicesProbe {
            override fun locationServicesAvailable(): Boolean = bridge.locationServicesAvailable()
        }

    @Provides
    @Singleton
    fun provideBluetoothEnabledProbe(port: com.sosmesh.android.core.ble.platform.BluetoothAdapterPort): BluetoothEnabledProbe =
        object : BluetoothEnabledProbe {
            override fun isBluetoothEnabled(): Boolean = port.isEnabled()
        }
}

package com.sosmesh.android.core.protocol.di

import com.sosmesh.android.core.protocol.BleTransferEngine
import com.sosmesh.android.core.protocol.BleTransferEnginePort
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class ProtocolModule {
    @Binds
    @Singleton
    abstract fun bindBleTransferEnginePort(engine: BleTransferEngine): BleTransferEnginePort
}

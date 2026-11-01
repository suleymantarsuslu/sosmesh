package com.sosmesh.android.feature.relay

import com.sosmesh.android.core.protocol.BleTransferEngine
import com.sosmesh.android.core.protocol.BleTransferReceiver
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object RelayModule {
    @Provides
    @Singleton
    fun provideRelayReceiverListener(handler: RelayTransferHandler): BleTransferReceiver.Listener = handler

    @Provides
    @Singleton
    fun wireRelayReceiver(
        engine: BleTransferEngine,
        relayListener: BleTransferReceiver.Listener,
    ): BleTransferEngine {
        engine.setRelayListener(relayListener)
        return engine
    }
}

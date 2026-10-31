package com.sosmesh.android.feature.relay

import com.sosmesh.android.core.protocol.BleTransferReceiver
import com.sosmesh.android.core.protocol.ErrorCode
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RelayTransferHandler
    @Inject
    constructor(
        private val registrar: RelayEnvelopeRegistrar,
    ) : BleTransferReceiver.Listener {
        override fun onCompleted(payload: ByteArray) {
            registrar.registerFromWirePayload(payload, System.currentTimeMillis())
        }

        override fun onFailed(
            code: ErrorCode,
            message: String,
        ) {
            // Relay path surfaces radio errors via registrar/outbox retry in later ADIM; skeleton logs only.
        }
    }

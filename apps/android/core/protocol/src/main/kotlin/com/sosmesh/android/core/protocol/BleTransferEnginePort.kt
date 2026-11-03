package com.sosmesh.android.core.protocol

interface BleTransferEnginePort {
    fun sendOutbound(
        sosId: String,
        digest: String,
        payload: ByteArray,
    )

    fun sendOpaqueForward(payload: ByteArray)

    fun onGattReady()

    fun senderState(): TransferState
}

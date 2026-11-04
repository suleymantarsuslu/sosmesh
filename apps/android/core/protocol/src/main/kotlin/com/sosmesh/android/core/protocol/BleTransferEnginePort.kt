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

    /**
     * mesh-v2 §5.2 central exchange: write [frame] on CONTROL and collect FFF3 notifications of [replyType]
     * for up to [windowMs] (stops after [maxFrames]). Returns null when the peer is v1 (no FFF4) or unsupported.
     */
    suspend fun meshV2Exchange(
        frame: ByteArray,
        replyType: Byte,
        windowMs: Long,
        maxFrames: Int,
    ): List<ByteArray>? = null
}

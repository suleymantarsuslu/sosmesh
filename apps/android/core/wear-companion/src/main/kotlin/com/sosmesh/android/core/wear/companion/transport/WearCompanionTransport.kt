package com.sosmesh.android.core.wear.companion.transport

interface WearCompanionTransport {
    fun isPhoneReachable(): Boolean

    fun sendCreateToPhone(
        payload: ByteArray,
        onSuccess: () -> Unit,
        onFailure: (String) -> Unit,
    )

    fun sendCreateToNode(
        nodeId: String,
        payload: ByteArray,
        onSuccess: () -> Unit,
        onFailure: (String) -> Unit,
    )
}

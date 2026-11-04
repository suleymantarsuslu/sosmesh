package com.sosmesh.android.core.ble

/**
 * Mesh v2 (docs/protocol/mesh-v2.md) hooks the BLE layer calls. Installed once by the mesh-v2 runtime;
 * when absent the radio behaves exactly like ble-v1. Implementations must not log payloads or PII.
 */
interface MeshV2BleHooks {
    /** 16-byte MESH_INFO value for FFF4 reads. */
    fun meshInfo(nowMs: Long): ByteArray

    /** 3-byte FFF0 service data (version, h, flags). */
    fun advertisementServiceData(nowMs: Long): ByteArray

    /** CONTROL write that is a v2 frame (OFFER / TOMBSTONE_REQUEST). Returns frames to notify on FFF3, or null if not v2. */
    fun onControlFrame(
        value: ByteArray,
        nowMs: Long,
        maxNotifyBytes: Int,
    ): List<ByteArray>?

    /** Advertisement seen from a peer: Android service data and/or 16-bit service UUIDs (iOS hops UUIDs). */
    fun onAdvertisement(
        peerAddress: String,
        rssi: Int,
        serviceData: ByteArray?,
        shortServiceUuids: List<Int>,
        nowMs: Long,
    )
}

object MeshV2Hooks {
    @Volatile
    var hooks: MeshV2BleHooks? = null

    const val MESH_INFO_CHAR_UUID: String = "0000FFF4-0000-1000-8000-00805F9B34FB"
    const val SERVICE_DATA_UUID_16: Int = 0xFFF0
    const val IOS_HOPS_UUID_FIRST: Int = 0xFFE0
    const val IOS_HOPS_UUID_LAST: Int = 0xFFE8
}

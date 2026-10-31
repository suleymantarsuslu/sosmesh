package com.sosmesh.android.core.ble

/**
 * Mirrors [packages/ble-protocol] SERVICE_UUID and GATT layout (ble-v1.md).
 */
object BleMeshConstants {
    const val SERVICE_UUID: String = "0000FFF0-0000-1000-8000-00805F9B34FB"
    const val CONTROL_CHAR_UUID: String = "0000FFF1-0000-1000-8000-00805F9B34FB"
    const val DATA_CHAR_UUID: String = "0000FFF2-0000-1000-8000-00805F9B34FB"
    const val ACK_CHAR_UUID: String = "0000FFF3-0000-1000-8000-00805F9B34FB"

    /** Test/development manufacturer company id (ble-v1.md). */
    const val MANUFACTURER_COMPANY_ID: Int = 0xFFFF

    const val OPAQUE_ID_BYTES: Int = 4
}

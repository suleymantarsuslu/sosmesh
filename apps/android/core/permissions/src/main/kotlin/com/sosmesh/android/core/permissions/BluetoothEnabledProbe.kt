package com.sosmesh.android.core.permissions

/** Platform hook for Bluetooth adapter power state. */
interface BluetoothEnabledProbe {
    fun isBluetoothEnabled(): Boolean
}

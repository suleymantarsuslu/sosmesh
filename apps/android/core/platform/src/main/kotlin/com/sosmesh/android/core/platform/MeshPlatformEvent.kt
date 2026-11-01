package com.sosmesh.android.core.platform

sealed class MeshPlatformEvent {
    data object NetworkAvailable : MeshPlatformEvent()

    data object NetworkLost : MeshPlatformEvent()

    data object BluetoothEnabled : MeshPlatformEvent()

    data object BluetoothDisabled : MeshPlatformEvent()

    data object BlePermissionsGranted : MeshPlatformEvent()

    data object BlePermissionsDenied : MeshPlatformEvent()

    data class BatteryLevelChanged(val percent: Int) : MeshPlatformEvent()

    data object PowerSaveEnabled : MeshPlatformEvent()

    data object PowerSaveDisabled : MeshPlatformEvent()

    data object DeviceIdleEnter : MeshPlatformEvent()

    data object DeviceIdleExit : MeshPlatformEvent()

    data object SosTransferStarted : MeshPlatformEvent()

    data object SosTransferEnded : MeshPlatformEvent()

    data object RelayOptIn : MeshPlatformEvent()

    data object RelayOptOut : MeshPlatformEvent()
}

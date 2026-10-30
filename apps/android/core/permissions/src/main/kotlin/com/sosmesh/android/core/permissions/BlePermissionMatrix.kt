package com.sosmesh.android.core.permissions

import android.Manifest

/**
 * Single source of truth for permission sets by API level (ADIM 12).
 * Runtime = dangerous permissions only (requestPermissions).
 * Manifest = normal/install-time declarations (legacy Bluetooth uses @Suppress here only).
 */
object BlePermissionMatrix {
    data class PermissionSet(val permissions: Set<String>)

    fun runtimePermissions(sdkInt: Int): PermissionSet {
        val required = linkedSetOf<String>()

        when {
            sdkInt >= 31 -> {
                required += Manifest.permission.BLUETOOTH_SCAN
                required += Manifest.permission.BLUETOOTH_CONNECT
                required += Manifest.permission.BLUETOOTH_ADVERTISE
            }
            else -> {
                required += Manifest.permission.ACCESS_FINE_LOCATION
                required += Manifest.permission.ACCESS_COARSE_LOCATION
            }
        }

        if (sdkInt >= 33) {
            required += Manifest.permission.POST_NOTIFICATIONS
        }

        return PermissionSet(required)
    }

    fun manifestPermissions(sdkInt: Int): PermissionSet {
        val manifest = linkedSetOf<String>()

        if (sdkInt <= 30) {
            // Legacy Bluetooth is manifest-only (maxSdkVersion=30 in source manifest).
            @Suppress("DEPRECATION")
            manifest += Manifest.permission.BLUETOOTH
            @Suppress("DEPRECATION")
            manifest += Manifest.permission.BLUETOOTH_ADMIN
        }

        if (sdkInt >= 29) {
            manifest += Manifest.permission.FOREGROUND_SERVICE
        }

        if (sdkInt >= 34) {
            manifest += Manifest.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE
        }

        return PermissionSet(manifest)
    }

    fun allDeclaredPermissions(sdkInt: Int): PermissionSet {
        val union = linkedSetOf<String>()
        union += runtimePermissions(sdkInt).permissions
        union += manifestPermissions(sdkInt).permissions
        return PermissionSet(union)
    }
}

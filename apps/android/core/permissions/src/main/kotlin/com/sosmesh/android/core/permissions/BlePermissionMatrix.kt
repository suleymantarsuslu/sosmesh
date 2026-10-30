package com.sosmesh.android.core.permissions

import android.Manifest

/**
 * Single source of truth for runtime permission sets by API level (ADIM 12).
 * BLUETOOTH_SCAN is declared with `neverForLocation` in the manifest; matrix reflects that policy.
 */
object BlePermissionMatrix {
    data class PermissionSet(val permissions: Set<String>)

    fun requiredRuntimePermissions(sdkInt: Int): PermissionSet {
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
                @Suppress("DEPRECATION")
                required += Manifest.permission.BLUETOOTH
                @Suppress("DEPRECATION")
                required += Manifest.permission.BLUETOOTH_ADMIN
            }
        }

        if (sdkInt >= 33) {
            required += Manifest.permission.POST_NOTIFICATIONS
        }

        if (sdkInt >= 34) {
            required += Manifest.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE
        }

        return PermissionSet(required)
    }

    fun manifestPermissions(sdkInt: Int): PermissionSet {
        val manifest = linkedSetOf<String>()
        manifest += requiredRuntimePermissions(sdkInt).permissions
        if (sdkInt >= 29) {
            manifest += Manifest.permission.FOREGROUND_SERVICE
        }
        if (sdkInt >= 34) {
            manifest += Manifest.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE
        }
        return PermissionSet(manifest)
    }
}

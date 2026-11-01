package com.sosmesh.android.core.ble.android

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.sosmesh.android.core.permissions.BlePermissionMatrix

internal object AndroidBlePermissionCheck {
    fun hasRuntimePermissions(context: Context): Boolean {
        val required = BlePermissionMatrix.runtimePermissions(Build.VERSION.SDK_INT).permissions
        return required.all { permission ->
            ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
        }
    }

    fun canScan(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= 31) {
            return ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_SCAN) ==
                PackageManager.PERMISSION_GRANTED
        }
        return hasRuntimePermissions(context)
    }

    fun canAdvertise(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= 31) {
            return ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_ADVERTISE) ==
                PackageManager.PERMISSION_GRANTED
        }
        return hasRuntimePermissions(context)
    }

    fun canConnect(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= 31) {
            return ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) ==
                PackageManager.PERMISSION_GRANTED
        }
        return hasRuntimePermissions(context)
    }
}

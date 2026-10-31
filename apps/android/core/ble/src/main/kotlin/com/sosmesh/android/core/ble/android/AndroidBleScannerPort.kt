package com.sosmesh.android.core.ble.android

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.BluetoothLeScanner
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.ParcelUuid
import androidx.annotation.RequiresPermission
import androidx.core.content.PermissionChecker
import com.sosmesh.android.core.ble.BleScanProfile
import com.sosmesh.android.core.ble.platform.BleScannerPort
import com.sosmesh.android.core.ble.platform.ScanCallbackPort
import com.sosmesh.android.core.ble.platform.ScanRequest
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AndroidBleScannerPort
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) : BleScannerPort {
        private var scanner: BluetoothLeScanner? = null
        private var activeCallback: ScanCallback? = null

        override fun startScan(
            request: ScanRequest,
            callback: ScanCallbackPort,
        ): Result<Unit> {
            if (PermissionChecker.checkSelfPermission(context, Manifest.permission.BLUETOOTH_SCAN) !=
                PermissionChecker.PERMISSION_GRANTED
            ) {
                return Result.failure(SecurityException("BLUETOOTH_SCAN not granted"))
            }
            val adapter = bluetoothAdapter() ?: return Result.failure(IllegalStateException("No BT adapter"))
            scanner = adapter.bluetoothLeScanner
            val leScanner = scanner ?: return Result.failure(IllegalStateException("No LE scanner"))

            val scanMode =
                when (request.scanMode) {
                    BleScanProfile.FOREGROUND_LOW_POWER_SCAN_MODE -> ScanSettings.SCAN_MODE_LOW_POWER
                    else -> ScanSettings.SCAN_MODE_BALANCED
                }

            val settings =
                ScanSettings.Builder()
                    .setScanMode(scanMode)
                    .setReportDelay(request.reportDelayMillis)
                    .build()

            val filter =
                ScanFilter.Builder()
                    .setServiceUuid(ParcelUuid(UUID.fromString(request.serviceUuid)))
                    .build()

            val scanCallback =
                object : ScanCallback() {
                    override fun onScanResult(
                        callbackType: Int,
                        result: ScanResult?,
                    ) {
                        val record = result?.scanRecord ?: return
                        val payload = record.manufacturerSpecificData?.valueAt(0)
                        callback.onScanResult(request.serviceUuid, payload)
                    }
                }
            activeCallback = scanCallback
            return try {
                startScanInternal(leScanner, filter, settings, scanCallback)
                Result.success(Unit)
            } catch (securityException: SecurityException) {
                Result.failure(securityException)
            }
        }

        override fun stopScan() {
            val leScanner = scanner
            val callback = activeCallback
            if (leScanner != null && callback != null) {
                if (PermissionChecker.checkSelfPermission(context, Manifest.permission.BLUETOOTH_SCAN) ==
                    PermissionChecker.PERMISSION_GRANTED
                ) {
                    stopScanInternal(leScanner, callback)
                }
            }
            activeCallback = null
        }

        @RequiresPermission(Manifest.permission.BLUETOOTH_SCAN)
        private fun startScanInternal(
            leScanner: BluetoothLeScanner,
            filter: ScanFilter,
            settings: ScanSettings,
            scanCallback: ScanCallback,
        ) {
            leScanner.startScan(listOf(filter), settings, scanCallback)
        }

        @RequiresPermission(Manifest.permission.BLUETOOTH_SCAN)
        private fun stopScanInternal(
            leScanner: BluetoothLeScanner,
            callback: ScanCallback,
        ) {
            leScanner.stopScan(callback)
        }

        private fun bluetoothAdapter(): BluetoothAdapter? {
            if (PermissionChecker.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) !=
                PermissionChecker.PERMISSION_GRANTED
            ) {
                return null
            }
            val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            return manager?.adapter
        }
    }

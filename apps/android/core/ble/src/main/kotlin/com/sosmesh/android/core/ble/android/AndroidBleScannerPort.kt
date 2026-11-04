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
import com.sosmesh.android.core.ble.BleMeshConstants
import com.sosmesh.android.core.ble.MeshV2Hooks
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
            if (!AndroidBlePermissionCheck.canScan(context)) {
                return Result.failure(SecurityException("BLE scan permission not granted"))
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
                        MeshV2Hooks.hooks?.let { hooks ->
                            val uuids =
                                record.serviceUuids.orEmpty().mapNotNull { parcel ->
                                    val msb = parcel.uuid.mostSignificantBits
                                    if (parcel.uuid.leastSignificantBits == BASE_UUID_LSB && (msb and 0xFFFFL) == 0x1000L) {
                                        ((msb ushr 32) and 0xFFFFL).toInt()
                                    } else {
                                        null
                                    }
                                }
                            val serviceData = record.getServiceData(ParcelUuid(UUID.fromString(BleMeshConstants.SERVICE_UUID)))
                            val address = result.device?.address
                            if (address != null) {
                                hooks.onAdvertisement(address, result.rssi, serviceData, uuids, System.currentTimeMillis())
                            }
                        }
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
            leScanner.startScan(listOf(filter) + iosHopsFilters(), settings, scanCallback)
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

private const val BASE_UUID_LSB: Long = -0x7fffff7fa064cb05L

/** mesh-v2 §4.2: iOS hops UUIDs 0xFFE0..0xFFE8 (background iOS peers may only expose these). */
private fun iosHopsFilters(): List<ScanFilter> =
    (MeshV2Hooks.IOS_HOPS_UUID_FIRST..MeshV2Hooks.IOS_HOPS_UUID_LAST).map { short ->
        ScanFilter.Builder()
            .setServiceUuid(ParcelUuid(UUID.fromString(String.format("0000%04X-0000-1000-8000-00805F9B34FB", short))))
            .build()
    }

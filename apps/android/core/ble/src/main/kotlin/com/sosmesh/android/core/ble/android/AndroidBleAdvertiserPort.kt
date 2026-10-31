package com.sosmesh.android.core.ble.android

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeAdvertiser
import android.content.Context
import android.os.ParcelUuid
import androidx.annotation.RequiresPermission
import androidx.core.content.PermissionChecker
import com.sosmesh.android.core.ble.platform.AdvertiseRequest
import com.sosmesh.android.core.ble.platform.BleAdvertiserPort
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AndroidBleAdvertiserPort
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) : BleAdvertiserPort {
        private var advertiser: BluetoothLeAdvertiser? = null
        private var callback: AdvertiseCallback? = null

        override fun startAdvertising(request: AdvertiseRequest): Result<Unit> {
            if (PermissionChecker.checkSelfPermission(context, Manifest.permission.BLUETOOTH_ADVERTISE) !=
                PermissionChecker.PERMISSION_GRANTED
            ) {
                return Result.failure(SecurityException("BLUETOOTH_ADVERTISE not granted"))
            }
            val adapter = bluetoothAdapter() ?: return Result.failure(IllegalStateException("No BT adapter"))
            advertiser = adapter.bluetoothLeAdvertiser
            val leAdvertiser = advertiser ?: return Result.failure(IllegalStateException("No LE advertiser"))

            val settings =
                AdvertiseSettings.Builder()
                    .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_POWER)
                    .setConnectable(true)
                    .build()

            val serviceUuid = ParcelUuid(UUID.fromString(request.serviceUuid))
            val dataBuilder =
                AdvertiseData.Builder()
                    .addServiceUuid(serviceUuid)
                    .setIncludeDeviceName(request.includeDeviceName)
                    .setIncludeTxPowerLevel(false)

            if (request.manufacturerPayload.isNotEmpty()) {
                dataBuilder.addManufacturerData(
                    request.manufacturerCompanyId,
                    request.manufacturerPayload,
                )
            }

            val advertiseCallback =
                object : AdvertiseCallback() {
                    override fun onStartSuccess(settingsInEffect: AdvertiseSettings?) {
                        // no-op
                    }

                    override fun onStartFailure(errorCode: Int) {
                        // surfaced via Result below when start fails synchronously only
                    }
                }
            callback = advertiseCallback
            return try {
                startAdvertisingInternal(leAdvertiser, settings, dataBuilder.build(), advertiseCallback)
                Result.success(Unit)
            } catch (securityException: SecurityException) {
                Result.failure(securityException)
            }
        }

        override fun stopAdvertising() {
            val leAdvertiser = advertiser
            val activeCallback = callback
            if (leAdvertiser != null && activeCallback != null) {
                if (PermissionChecker.checkSelfPermission(context, Manifest.permission.BLUETOOTH_ADVERTISE) ==
                    PermissionChecker.PERMISSION_GRANTED
                ) {
                    stopAdvertisingInternal(leAdvertiser, activeCallback)
                }
            }
            callback = null
        }

        @RequiresPermission(Manifest.permission.BLUETOOTH_ADVERTISE)
        private fun startAdvertisingInternal(
            leAdvertiser: BluetoothLeAdvertiser,
            settings: AdvertiseSettings,
            data: AdvertiseData,
            advertiseCallback: AdvertiseCallback,
        ) {
            leAdvertiser.startAdvertising(settings, data, advertiseCallback)
        }

        @RequiresPermission(Manifest.permission.BLUETOOTH_ADVERTISE)
        private fun stopAdvertisingInternal(
            leAdvertiser: BluetoothLeAdvertiser,
            activeCallback: AdvertiseCallback,
        ) {
            leAdvertiser.stopAdvertising(activeCallback)
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

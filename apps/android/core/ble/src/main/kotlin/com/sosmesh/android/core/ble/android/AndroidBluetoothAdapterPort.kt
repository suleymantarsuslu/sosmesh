package com.sosmesh.android.core.ble.android

import android.bluetooth.BluetoothManager
import android.content.Context
import com.sosmesh.android.core.ble.platform.BluetoothAdapterPort
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AndroidBluetoothAdapterPort
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) : BluetoothAdapterPort {
        override fun isEnabled(): Boolean {
            val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            val adapter = manager?.adapter ?: return false
            return adapter.isEnabled
        }
    }

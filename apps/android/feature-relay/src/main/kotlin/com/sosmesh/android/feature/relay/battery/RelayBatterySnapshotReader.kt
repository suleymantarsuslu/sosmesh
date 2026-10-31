package com.sosmesh.android.feature.relay.battery

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RelayBatterySnapshotReader
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) {
        fun read(): RelayBatterySnapshot {
            val intent =
                context.registerReceiver(
                    null,
                    IntentFilter(Intent.ACTION_BATTERY_CHANGED),
                )
            val level = intent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
            val scale = intent?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
            val status = intent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
            val percent =
                if (level >= 0 && scale > 0) {
                    ((level * 100f) / scale).toInt().coerceIn(0, 100)
                } else {
                    100
                }
            val charging =
                status == BatteryManager.BATTERY_STATUS_CHARGING ||
                    status == BatteryManager.BATTERY_STATUS_FULL
            return RelayBatterySnapshot(levelPercent = percent, isCharging = charging)
        }
    }

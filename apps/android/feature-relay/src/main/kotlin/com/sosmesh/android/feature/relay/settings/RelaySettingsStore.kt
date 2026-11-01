package com.sosmesh.android.feature.relay.settings

import android.content.Context
import android.content.SharedPreferences
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * User-opt-in relay preferences. Relay is off until the volunteer explicitly enables it.
 */
@Singleton
class RelaySettingsStore
    @Inject
    constructor(
        @ApplicationContext context: Context,
    ) : RelaySettingsPort {
        private val prefs: SharedPreferences =
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        override fun isRelayEnabled(): Boolean = prefs.getBoolean(KEY_RELAY_ENABLED, DEFAULT_RELAY_ENABLED)

        fun setRelayEnabled(enabled: Boolean) {
            prefs.edit().putBoolean(KEY_RELAY_ENABLED, enabled).commit()
        }

        override fun batteryThresholdPercent(): Int = prefs.getInt(KEY_BATTERY_THRESHOLD, DEFAULT_BATTERY_THRESHOLD_PERCENT)

        fun setBatteryThresholdPercent(percent: Int) {
            prefs.edit().putInt(KEY_BATTERY_THRESHOLD, percent.coerceIn(5, 50)).commit()
        }

        override fun hourlyDataLimitBytes(): Long = prefs.getLong(KEY_HOURLY_DATA_LIMIT, DEFAULT_HOURLY_DATA_LIMIT_BYTES)

        fun setHourlyDataLimitBytes(bytes: Long) {
            prefs.edit().putLong(KEY_HOURLY_DATA_LIMIT, bytes.coerceAtLeast(64 * 1024)).commit()
        }

        companion object {
            const val PREFS_NAME = "relay_settings"
            const val KEY_RELAY_ENABLED = "relay_enabled"
            const val KEY_BATTERY_THRESHOLD = "battery_threshold_percent"
            const val KEY_HOURLY_DATA_LIMIT = "hourly_data_limit_bytes"

            const val DEFAULT_RELAY_ENABLED = false
            const val DEFAULT_BATTERY_THRESHOLD_PERCENT = 20
            const val DEFAULT_HOURLY_DATA_LIMIT_BYTES = 5L * 1024L * 1024L
        }
    }

package com.sosmesh.android.feature.relay.settings

import android.content.Context
import android.content.SharedPreferences
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RelayHourlyDataBudget
    @Inject
    constructor(
        @ApplicationContext context: Context,
    ) {
        private val prefs: SharedPreferences =
            context.getSharedPreferences(RelaySettingsStore.PREFS_NAME, Context.MODE_PRIVATE)

        fun bytesUsedInCurrentWindow(nowMs: Long): Long {
            val windowStart = prefs.getLong(KEY_WINDOW_START_MS, 0L)
            if (windowStart <= 0L || nowMs - windowStart >= WINDOW_MS) {
                return 0L
            }
            return prefs.getLong(KEY_BYTES_USED, 0L)
        }

        fun canSend(
            payloadBytes: Int,
            limitBytes: Long,
            nowMs: Long,
        ): Boolean {
            val used = bytesUsedInCurrentWindow(nowMs)
            return used + payloadBytes.toLong() <= limitBytes
        }

        fun recordSent(
            payloadBytes: Int,
            nowMs: Long,
        ) {
            val windowStart = prefs.getLong(KEY_WINDOW_START_MS, 0L)
            val editor = prefs.edit()
            if (windowStart <= 0L || nowMs - windowStart >= WINDOW_MS) {
                editor.putLong(KEY_WINDOW_START_MS, nowMs)
                editor.putLong(KEY_BYTES_USED, payloadBytes.toLong())
            } else {
                val used = prefs.getLong(KEY_BYTES_USED, 0L)
                editor.putLong(KEY_BYTES_USED, used + payloadBytes)
            }
            editor.commit()
        }

        fun resetForTests() {
            prefs.edit().clear().commit()
        }

        companion object {
            private const val KEY_WINDOW_START_MS = "hourly_window_start_ms"
            private const val KEY_BYTES_USED = "hourly_bytes_used"
            const val WINDOW_MS: Long = 3_600_000L
        }
    }

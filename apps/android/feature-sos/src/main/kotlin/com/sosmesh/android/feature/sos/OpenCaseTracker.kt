package com.sosmesh.android.feature.sos

import android.content.Context
import android.content.SharedPreferences
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class OpenCaseTracker
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) {
        private val prefs: SharedPreferences =
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        fun markCaseOpen(
            sosId: String,
            nowMs: Long,
        ) {
            prefs
                .edit()
                .putLong(KEY_OPEN_CASE_TIMESTAMP, nowMs)
                .putString(KEY_OPEN_CASE_SOS_ID, sosId)
                .apply()
        }

        fun hasOpenCase(nowMs: Long): Boolean {
            val timestamp = prefs.getLong(KEY_OPEN_CASE_TIMESTAMP, 0L)
            if (timestamp == 0L) return false
            return nowMs - timestamp < CASE_OPEN_DURATION_MS
        }

        fun getOpenCaseSosId(): String? {
            val timestamp = prefs.getLong(KEY_OPEN_CASE_TIMESTAMP, 0L)
            if (timestamp == 0L) return null
            val nowMs = System.currentTimeMillis()
            if (nowMs - timestamp >= CASE_OPEN_DURATION_MS) {
                clearOpenCase()
                return null
            }
            return prefs.getString(KEY_OPEN_CASE_SOS_ID, null)
        }

        fun clearOpenCase() {
            prefs
                .edit()
                .remove(KEY_OPEN_CASE_TIMESTAMP)
                .remove(KEY_OPEN_CASE_SOS_ID)
                .apply()
        }

        fun markDeliveryDialogShown(sosId: String) {
            val shown = getShownDeliveryDialogs()
            shown.add(sosId)
            prefs
                .edit()
                .putStringSet(KEY_DELIVERY_DIALOGS_SHOWN, shown)
                .apply()
        }

        fun hasShownDeliveryDialog(sosId: String): Boolean {
            return getShownDeliveryDialogs().contains(sosId)
        }

        private fun getShownDeliveryDialogs(): MutableSet<String> {
            return prefs.getStringSet(KEY_DELIVERY_DIALOGS_SHOWN, emptySet())?.toMutableSet() ?: mutableSetOf()
        }

        companion object {
            private const val PREFS_NAME = "sos_open_case_tracker"
            private const val KEY_OPEN_CASE_TIMESTAMP = "open_case_timestamp"
            private const val KEY_OPEN_CASE_SOS_ID = "open_case_sos_id"
            private const val KEY_DELIVERY_DIALOGS_SHOWN = "delivery_dialogs_shown"
            private const val CASE_OPEN_DURATION_MS = 24L * 3600_000L
        }
    }

package com.sosmesh.android.feature.relay

import android.content.Context
import android.content.SharedPreferences
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RelayDeliveryCounter
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) {
        private val prefs: SharedPreferences =
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        fun markMessageDelivered(messageId: String) {
            val deliveredIds = getDeliveredMessageIds()
            if (deliveredIds.add(messageId)) {
                prefs
                    .edit()
                    .putStringSet(KEY_DELIVERED_IDS, deliveredIds)
                    .apply()
            }
        }

        fun getDeliveredCount(): Int {
            return getDeliveredMessageIds().size
        }

        private fun getDeliveredMessageIds(): MutableSet<String> {
            return prefs.getStringSet(KEY_DELIVERED_IDS, emptySet())?.toMutableSet() ?: mutableSetOf()
        }

        companion object {
            private const val PREFS_NAME = "relay_delivery_counter"
            private const val KEY_DELIVERED_IDS = "delivered_message_ids"
        }
    }

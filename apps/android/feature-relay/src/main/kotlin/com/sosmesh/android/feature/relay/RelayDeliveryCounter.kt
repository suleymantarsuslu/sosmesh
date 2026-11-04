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

        fun recordCarriedMessage(messageId: String) {
            val carriedIds = getCarriedMessageIds()
            if (carriedIds.add(messageId)) {
                pruneCarriedMessages(carriedIds)
                prefs
                    .edit()
                    .putStringSet(KEY_CARRIED_IDS, carriedIds)
                    .apply()
            }
        }

        fun getPendingCarriedIds(): List<String> {
            val carried = getCarriedMessageIds()
            val delivered = getDeliveredMessageIds()
            return carried.filter { it !in delivered }
        }

        fun markCarriedMessagesDelivered(messageIds: List<String>) {
            val deliveredIds = getDeliveredMessageIds()
            var changed = false
            for (id in messageIds) {
                if (deliveredIds.add(id)) {
                    changed = true
                }
            }
            if (changed) {
                prefs
                    .edit()
                    .putStringSet(KEY_DELIVERED_IDS, deliveredIds)
                    .apply()
            }
        }

        private fun pruneCarriedMessages(carriedIds: MutableSet<String>) {
            if (carriedIds.size > MAX_CARRIED_IDS) {
                val sorted = carriedIds.sorted()
                val toRemove = sorted.take(carriedIds.size - MAX_CARRIED_IDS)
                carriedIds.removeAll(toRemove.toSet())
            }
        }

        private fun getDeliveredMessageIds(): MutableSet<String> {
            return prefs.getStringSet(KEY_DELIVERED_IDS, emptySet())?.toMutableSet() ?: mutableSetOf()
        }

        private fun getCarriedMessageIds(): MutableSet<String> {
            return prefs.getStringSet(KEY_CARRIED_IDS, emptySet())?.toMutableSet() ?: mutableSetOf()
        }

        companion object {
            private const val PREFS_NAME = "relay_delivery_counter"
            private const val KEY_DELIVERED_IDS = "delivered_message_ids"
            private const val KEY_CARRIED_IDS = "carried_message_ids"
            private const val MAX_CARRIED_IDS = 500
        }
    }

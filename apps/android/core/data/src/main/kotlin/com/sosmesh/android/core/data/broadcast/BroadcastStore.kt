package com.sosmesh.android.core.data.broadcast

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import java.time.Instant

private val Context.broadcastDataStore by preferencesDataStore("broadcast_seen_cache")

class BroadcastStore(private val context: Context) {
    private val seenKey = stringPreferencesKey("seen_ids")
    private val lastFetchKey = stringPreferencesKey("last_fetch")

    suspend fun isSeen(id: String): Boolean {
        val seen = context.broadcastDataStore.data.map { prefs ->
            prefs[seenKey]?.split(",")?.toSet() ?: emptySet()
        }.first()
        return seen.contains(id)
    }

    suspend fun markSeen(id: String) {
        context.broadcastDataStore.edit { prefs ->
            val current = prefs[seenKey]?.split(",")?.toMutableSet() ?: mutableSetOf()
            current.add(id)
            if (current.size > 500) {
                current.take(250).toSet()
            }
            prefs[seenKey] = current.joinToString(",")
        }
    }

    suspend fun getLastFetchTime(): String? {
        return context.broadcastDataStore.data.map { prefs ->
            prefs[lastFetchKey]
        }.first()
    }

    suspend fun updateLastFetchTime(time: String = Instant.now().toString()) {
        context.broadcastDataStore.edit { prefs ->
            prefs[lastFetchKey] = time
        }
    }
}

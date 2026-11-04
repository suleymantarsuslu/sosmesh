package com.sosmesh.android.core.data.notifications

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import org.json.JSONArray
import org.json.JSONObject

private val Context.notificationHistoryDataStore by preferencesDataStore("notification_history")

class NotificationHistoryStore(private val context: Context) {
    private val itemsKey = stringPreferencesKey("items")
    private val maxItems = 200

    val items: Flow<List<NotificationHistoryItem>> =
        context.notificationHistoryDataStore.data.map { prefs ->
            val json = prefs[itemsKey] ?: return@map emptyList()
            parseItems(json)
        }

    suspend fun addItem(item: NotificationHistoryItem) {
        context.notificationHistoryDataStore.edit { prefs ->
            val current = parseItems(prefs[itemsKey] ?: "[]").toMutableList()
            current.removeAll { it.id == item.id }
            current.add(0, item)
            if (current.size > maxItems) {
                current.subList(maxItems, current.size).clear()
            }
            prefs[itemsKey] = serializeItems(current)
        }
    }

    suspend fun markAllRead() {
        context.notificationHistoryDataStore.edit { prefs ->
            val current = parseItems(prefs[itemsKey] ?: "[]")
            val updated = current.map { it.copy(isRead = true) }
            prefs[itemsKey] = serializeItems(updated)
        }
    }

    suspend fun clearAll() {
        context.notificationHistoryDataStore.edit { prefs ->
            prefs[itemsKey] = "[]"
        }
    }

    suspend fun getUnreadCount(): Int {
        return context.notificationHistoryDataStore.data.map { prefs ->
            val items = parseItems(prefs[itemsKey] ?: "[]")
            items.count { !it.isRead }
        }.first()
    }

    private fun parseItems(json: String): List<NotificationHistoryItem> {
        return try {
            val array = JSONArray(json)
            (0 until array.length()).mapNotNull { i ->
                val obj = array.getJSONObject(i)
                NotificationHistoryItem(
                    id = obj.getString("id"),
                    type = NotificationType.valueOf(obj.getString("type")),
                    title = obj.getString("title"),
                    body = obj.getString("body"),
                    severity = if (obj.has("severity")) obj.getString("severity") else null,
                    regionName = if (obj.has("regionName")) obj.getString("regionName") else null,
                    sosId = if (obj.has("sosId")) obj.getString("sosId") else null,
                    timestampMs = obj.getLong("timestampMs"),
                    isRead = obj.getBoolean("isRead"),
                )
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    private fun serializeItems(items: List<NotificationHistoryItem>): String {
        val array = JSONArray()
        items.forEach { item ->
            val obj =
                JSONObject().apply {
                    put("id", item.id)
                    put("type", item.type.name)
                    put("title", item.title)
                    put("body", item.body)
                    if (item.severity != null) put("severity", item.severity)
                    if (item.regionName != null) put("regionName", item.regionName)
                    if (item.sosId != null) put("sosId", item.sosId)
                    put("timestampMs", item.timestampMs)
                    put("isRead", item.isRead)
                }
            array.put(obj)
        }
        return array.toString()
    }
}

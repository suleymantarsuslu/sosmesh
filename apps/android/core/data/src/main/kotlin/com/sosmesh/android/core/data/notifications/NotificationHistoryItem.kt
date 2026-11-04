package com.sosmesh.android.core.data.notifications

data class NotificationHistoryItem(
    val id: String,
    val type: NotificationType,
    val title: String,
    val body: String,
    val severity: String? = null,
    val regionName: String? = null,
    val sosId: String? = null,
    val timestampMs: Long,
    val isRead: Boolean = false,
)

enum class NotificationType {
    BROADCAST,
    INCOMING_SOS,
}

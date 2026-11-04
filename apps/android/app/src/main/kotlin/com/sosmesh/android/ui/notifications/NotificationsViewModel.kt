package com.sosmesh.android.ui.notifications

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sosmesh.android.core.data.notifications.NotificationHistoryItem
import com.sosmesh.android.core.data.notifications.NotificationHistoryStore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class NotificationsViewModel
    @Inject
    constructor(
        private val historyStore: NotificationHistoryStore,
    ) : ViewModel() {
        private val _expandedItemId = MutableStateFlow<String?>(null)

        val uiState: StateFlow<NotificationsUiState> =
            historyStore.items
                .map { items ->
                    NotificationsUiState(
                        items = items,
                        expandedItemId = _expandedItemId.value,
                    )
                }.stateIn(
                    viewModelScope,
                    SharingStarted.WhileSubscribed(5_000),
                    NotificationsUiState(emptyList(), null),
                )

        fun markAllRead() {
            viewModelScope.launch {
                historyStore.markAllRead()
            }
        }

        fun clearAll() {
            viewModelScope.launch {
                historyStore.clearAll()
            }
        }

        fun toggleExpanded(itemId: String) {
            _expandedItemId.value = if (_expandedItemId.value == itemId) null else itemId
        }
    }

data class NotificationsUiState(
    val items: List<NotificationHistoryItem>,
    val expandedItemId: String?,
)

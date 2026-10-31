package com.sosmesh.android.feature.status

import androidx.lifecycle.ViewModel
import com.sosmesh.contracts.transport.OutboxEntryMeta
import com.sosmesh.contracts.transport.OutboxQueueAdapter
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject

data class StatusUiState(
    val entries: List<OutboxEntryMeta> = emptyList(),
    val offline: Boolean = true,
)

@HiltViewModel
class StatusViewModel
    @Inject
    constructor(
        private val outbox: OutboxQueueAdapter,
    ) : ViewModel() {
        private val _uiState = MutableStateFlow(StatusUiState())
        val uiState: StateFlow<StatusUiState> = _uiState.asStateFlow()

        init {
            refresh()
        }

        fun refresh() {
            _uiState.value =
                StatusUiState(
                    entries = outbox.listAll().sortedByDescending { it.createdAtMs },
                    offline = true,
                )
        }
    }

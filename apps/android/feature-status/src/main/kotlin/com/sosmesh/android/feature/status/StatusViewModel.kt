package com.sosmesh.android.feature.status

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sosmesh.android.core.data.mesh.SosPeerDeliveryPort
import com.sosmesh.contracts.transport.OutboxEntryMeta
import com.sosmesh.contracts.transport.OutboxQueueAdapter
import android.util.Log
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
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
        private val peerDelivery: SosPeerDeliveryPort,
    ) : ViewModel() {
        private val _uiState = MutableStateFlow(StatusUiState())
        val uiState: StateFlow<StatusUiState> = _uiState.asStateFlow()

        init {
            refresh()
        }

        fun refresh() {
            viewModelScope.launch {
                runCatching {
                    peerDelivery.runPendingCycle(System.currentTimeMillis(), foregroundVisible = true)
                    _uiState.value =
                        StatusUiState(
                            entries = outbox.listAll().sortedByDescending { it.createdAtMs },
                            offline = true,
                        )
                }.onFailure { throwable ->
                    Log.e("StatusViewModel", "status_refresh_failed", throwable)
                }
            }
        }
    }

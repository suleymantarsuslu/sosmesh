package com.sosmesh.android.ui.home

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sosmesh.android.core.platform.CrossPlatformFaultEvaluator
import com.sosmesh.android.core.platform.CrossPlatformFaultHint
import com.sosmesh.android.core.platform.CrossPlatformFaultState
import com.sosmesh.android.core.platform.PlatformUserHint
import com.sosmesh.android.feature.sos.ExpressSosSaver
import com.sosmesh.android.platform.MeshPlatformSignalBridge
import com.sosmesh.contracts.transport.OutboxQueueAdapter
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class HomeUiState(
    val platformHint: PlatformUserHint = PlatformUserHint.NONE,
    val crossPlatformFault: CrossPlatformFaultHint = CrossPlatformFaultHint.NONE,
    val expressSavedMessageId: String? = null,
    val online: Boolean = false,
    val relayEnabled: Boolean = false,
    val queuedCount: Int = 0,
    val deliveredCount: Int = 0,
)

@HiltViewModel
class HomeViewModel
    @Inject
    constructor(
        private val platformBridge: MeshPlatformSignalBridge,
        private val expressSosSaver: ExpressSosSaver,
        private val outbox: OutboxQueueAdapter,
    ) : ViewModel() {
        private val _uiState = MutableStateFlow(HomeUiState())
        val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

        fun refreshPlatform() {
            val evaluation = platformBridge.refresh()
            val faultState =
                CrossPlatformFaultState(
                    bluetoothEnabled = evaluation.state.bluetoothEnabled,
                    blePermissionsGranted = evaluation.state.blePermissionsGranted,
                    locationAvailable = platformBridge.locationServicesAvailable(),
                    networkValidated = evaluation.state.networkValidated,
                    batteryLevelPercent = evaluation.state.batteryLevelPercent,
                    relayOptIn = evaluation.state.relayOptIn,
                    lastTransferCorrupt = platformBridge.lastTransferCorruptFlag(),
                    lastApiUploadFailed = platformBridge.lastApiUploadFailedFlag(),
                )
            _uiState.update {
                it.copy(
                    platformHint = evaluation.userHint,
                    crossPlatformFault = CrossPlatformFaultEvaluator.userHint(faultState),
                    online = evaluation.state.networkValidated,
                    relayEnabled = evaluation.state.relayOptIn,
                )
            }
            refreshOutboxCounts()
        }

        private fun refreshOutboxCounts() {
            viewModelScope.launch {
                runCatching { outbox.listAll() }
                    .onSuccess { entries ->
                        val delivered = entries.count { it.state in DELIVERED_STATES }
                        val queued = entries.count { it.state in QUEUED_STATES }
                        _uiState.update { it.copy(queuedCount = queued, deliveredCount = delivered) }
                    }.onFailure { throwable ->
                        if (throwable is CancellationException) throw throwable
                        Log.e("HomeViewModel", "home_outbox_counts_failed", throwable)
                    }
            }
        }

        fun expressSaveSos(nowMs: Long = System.currentTimeMillis()) {
            viewModelScope.launch {
                runCatching { expressSosSaver.save(nowMs) }
                    .onSuccess { messageId ->
                        _uiState.update { it.copy(expressSavedMessageId = messageId) }
                    }.onFailure { throwable ->
                        if (throwable is CancellationException) throw throwable
                        Log.e("HomeViewModel", "express_sos_failed", throwable)
                    }
            }
        }

        fun clearExpressResult() {
            _uiState.update { it.copy(expressSavedMessageId = null) }
        }

        private companion object {
            val QUEUED_STATES = setOf("LOCAL_SAVED", "PEER_RECEIVED")
            val DELIVERED_STATES = setOf("SERVER_ACCEPTED", "OPERATOR_SEEN", "CASE_IN_PROGRESS")
        }
    }

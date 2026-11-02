package com.sosmesh.android.ui.home

import androidx.lifecycle.ViewModel
import com.sosmesh.android.core.platform.CrossPlatformFaultEvaluator
import com.sosmesh.android.core.platform.CrossPlatformFaultHint
import com.sosmesh.android.core.platform.CrossPlatformFaultState
import com.sosmesh.android.core.platform.PlatformUserHint
import com.sosmesh.android.feature.sos.ExpressSosSaver
import com.sosmesh.android.platform.MeshPlatformSignalBridge
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import javax.inject.Inject

data class HomeUiState(
    val platformHint: PlatformUserHint = PlatformUserHint.NONE,
    val crossPlatformFault: CrossPlatformFaultHint = CrossPlatformFaultHint.NONE,
    val expressSavedMessageId: String? = null,
)

@HiltViewModel
class HomeViewModel
    @Inject
    constructor(
        private val platformBridge: MeshPlatformSignalBridge,
        private val expressSosSaver: ExpressSosSaver,
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
                )
            }
        }

        fun expressSaveSos(nowMs: Long = System.currentTimeMillis()): String {
            val messageId = expressSosSaver.save(nowMs)
            _uiState.update { it.copy(expressSavedMessageId = messageId) }
            return messageId
        }

        fun clearExpressResult() {
            _uiState.update { it.copy(expressSavedMessageId = null) }
        }
    }

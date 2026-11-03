package com.sosmesh.android.feature.sos

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sosmesh.android.core.data.mesh.SosPeerDeliveryKickResult
import com.sosmesh.android.core.data.mesh.SosPeerDeliveryPort
import com.sosmesh.android.core.data.sos.DraftInvalidReason
import com.sosmesh.android.core.data.sos.LocationSnapshot
import com.sosmesh.android.core.data.sos.SosComposeRequest
import com.sosmesh.android.core.data.sos.SosDraftInput
import com.sosmesh.android.core.data.sos.SosDraftValidation
import com.sosmesh.android.core.data.sos.SosDraftValidator
import com.sosmesh.android.core.model.SosType
import com.sosmesh.android.feature.sos.location.SosLocationProvider
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.Locale
import javax.inject.Inject

enum class SosWizardStep {
    FORM,
    PREVIEW,
    DONE,
}

enum class SosPeerDeliveryHint {
    NONE,
    TRANSFER_STARTED,
    WAITING_FOR_PEER,
    PERMISSIONS_REQUIRED,
    BLOCKED,
}

data class SosFormUiState(
    val step: SosWizardStep = SosWizardStep.FORM,
    val selectedType: SosType = SosType.DEPREM,
    val personCountText: String = "1",
    val personCountUnknown: Boolean = false,
    val note: String = "",
    val useManualLocation: Boolean = false,
    val manualLat: String = "",
    val manualLng: String = "",
    val gpsLocation: LocationSnapshot = LocationSnapshot.unknown(),
    val validationError: DraftInvalidReason? = null,
    val canContinue: Boolean = true,
    val savedMessageId: String? = null,
    val offlineMode: Boolean = true,
    val peerDeliveryHint: SosPeerDeliveryHint = SosPeerDeliveryHint.NONE,
)

@HiltViewModel
class SosFormViewModel
    @Inject
    constructor(
        private val locationProvider: SosLocationProvider,
        private val submitRepository: SosSubmitRepository,
        private val peerDelivery: SosPeerDeliveryPort,
    ) : ViewModel() {
        private val _uiState = MutableStateFlow(SosFormUiState())
        val uiState: StateFlow<SosFormUiState> = _uiState.asStateFlow()

        init {
            refreshLocation()
        }

        fun refreshLocation() {
            val loc = locationProvider.currentLocation()
            _uiState.update { it.copy(gpsLocation = loc) }
            revalidate()
        }

        fun selectType(type: SosType) {
            _uiState.update { it.copy(selectedType = type) }
        }

        fun setPersonCountText(value: String) {
            _uiState.update { it.copy(personCountText = value, personCountUnknown = false) }
            revalidate()
        }

        fun setPersonCountUnknown(unknown: Boolean) {
            _uiState.update {
                it.copy(
                    personCountUnknown = unknown,
                    personCountText = if (unknown) "" else it.personCountText,
                )
            }
            revalidate()
        }

        fun setNote(value: String) {
            _uiState.update { it.copy(note = value) }
            revalidate()
        }

        fun setUseManualLocation(enabled: Boolean) {
            _uiState.update { it.copy(useManualLocation = enabled) }
        }

        fun setManualLat(value: String) {
            _uiState.update { it.copy(manualLat = value) }
        }

        fun setManualLng(value: String) {
            _uiState.update { it.copy(manualLng = value) }
        }

        fun goToPreview() {
            if (!revalidate()) return
            _uiState.update { it.copy(step = SosWizardStep.PREVIEW, validationError = null) }
        }

        fun backFromPreview() {
            _uiState.update { it.copy(step = SosWizardStep.FORM) }
        }

        fun confirmAndSave(nowMs: Long = System.currentTimeMillis()) {
            if (!revalidate()) return
            viewModelScope.launch {
                performSaveAfterPreview(nowMs)
            }
        }

        internal suspend fun performSaveAfterPreview(nowMs: Long) {
            val state = _uiState.value
            val location = resolvedLocation(state)
            val personCount = SosDraftValidator.parsedPersonCount(state.toDraftInput())
            val language = Locale.getDefault().language
            val composed =
                submitRepository.submit(
                    SosComposeRequest(
                        sosType = state.selectedType,
                        personCount = personCount,
                        note = state.note,
                        location = location,
                        languageTag = language,
                        nowMs = nowMs,
                    ),
                )
            val delivery = peerDelivery.kickOffAfterLocalSave(nowMs, foregroundVisible = true)
            _uiState.update {
                it.copy(
                    step = SosWizardStep.DONE,
                    savedMessageId = composed.message.id,
                    peerDeliveryHint = delivery.toHint(),
                )
            }
        }

        fun resetFlow() {
            _uiState.value = SosFormUiState()
            refreshLocation()
        }

        fun effectiveLocation(state: SosFormUiState = _uiState.value): LocationSnapshot = resolvedLocation(state)

        private fun resolvedLocation(state: SosFormUiState): LocationSnapshot {
            if (state.useManualLocation) {
                val lat = state.manualLat.trim().toDoubleOrNull()
                val lng = state.manualLng.trim().toDoubleOrNull()
                if (lat != null && lng != null && lat in -90.0..90.0 && lng in -180.0..180.0) {
                    return LocationSnapshot.manual(lat, lng)
                }
            }
            return state.gpsLocation
        }

        private fun revalidate(): Boolean {
            val state = _uiState.value
            when (val result = SosDraftValidator.validate(state.toDraftInput())) {
                is SosDraftValidation.Valid -> {
                    _uiState.update { it.copy(validationError = null, canContinue = true) }
                    return true
                }
                is SosDraftValidation.Invalid -> {
                    _uiState.update {
                        it.copy(validationError = result.reason, canContinue = false)
                    }
                    return false
                }
            }
        }

        private fun SosFormUiState.toDraftInput(): SosDraftInput =
            SosDraftInput(
                sosType = selectedType,
                personCountText = personCountText,
                personCountUnknown = personCountUnknown,
                note = note,
            )

        private fun SosPeerDeliveryKickResult.toHint(): SosPeerDeliveryHint =
            when (this) {
                SosPeerDeliveryKickResult.Idle,
                SosPeerDeliveryKickResult.SenderBusy,
                SosPeerDeliveryKickResult.TransferStarted,
                -> SosPeerDeliveryHint.TRANSFER_STARTED
                SosPeerDeliveryKickResult.WaitingForGatt -> SosPeerDeliveryHint.WAITING_FOR_PEER
                is SosPeerDeliveryKickResult.PermissionsMissing -> SosPeerDeliveryHint.PERMISSIONS_REQUIRED
                is SosPeerDeliveryKickResult.Blocked -> SosPeerDeliveryHint.BLOCKED
            }
    }

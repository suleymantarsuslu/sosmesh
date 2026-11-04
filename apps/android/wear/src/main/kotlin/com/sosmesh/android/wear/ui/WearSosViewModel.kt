package com.sosmesh.android.wear.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sosmesh.android.core.ble.BleMeshRadio
import com.sosmesh.android.core.data.sos.SosComposeRequest
import com.sosmesh.android.core.data.sos.SosMessageComposer
import com.sosmesh.android.core.model.SosType
import com.sosmesh.android.core.wear.companion.sync.WearUserFacingPhase
import com.sosmesh.android.core.wear.companion.watch.WearSosCoordinator
import com.sosmesh.android.meshv2.v2.MeshV2Runtime
import com.sosmesh.contracts.transport.EnqueueInput
import com.sosmesh.contracts.transport.OutboxQueueAdapter
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Base64
import java.util.UUID
import javax.inject.Inject

enum class WearConfirmStep {
    IDLE,
    FIRST_ARMED,
    CONFIRM_DIALOG,
    CANCELLED,
}

@HiltViewModel
class WearSosViewModel
    @Inject
    constructor(
        private val companionCoordinator: WearSosCoordinator,
        private val companionTransport: com.sosmesh.android.core.wear.companion.transport.WearCompanionTransport,
        private val meshRuntime: MeshV2Runtime,
        private val bleMeshRadio: BleMeshRadio,
        private val sosComposer: SosMessageComposer,
        private val outbox: OutboxQueueAdapter,
    ) : ViewModel() {
        var confirmStep by mutableStateOf(WearConfirmStep.IDLE)
            private set

        var statusHeadline by mutableStateOf("SOS")
            private set

        var statusDetail by mutableStateOf("Acil durumda iki adımda onaylayın.")
            private set

        var isAmbientMode by mutableStateOf(false)
            private set

        var userFacingPhase by mutableStateOf(WearUserFacingPhase.IDLE)
            private set

        var showsFalseSuccess by mutableStateOf(false)
            private set

        fun applyAmbientMode(enabled: Boolean) {
            isAmbientMode = enabled
        }

        fun onSosPressStart() {
            if (confirmStep == WearConfirmStep.IDLE) {
                confirmStep = WearConfirmStep.FIRST_ARMED
            }
        }

        fun onSosPressRelease() {
            if (confirmStep == WearConfirmStep.FIRST_ARMED) {
                confirmStep = WearConfirmStep.CONFIRM_DIALOG
            }
        }

        fun onConfirmCancel() {
            confirmStep = WearConfirmStep.CANCELLED
            statusHeadline = "SOS gönderilmedi"
            statusDetail = "İptal edildi."
        }

        fun onCancelAcknowledged() {
            if (confirmStep == WearConfirmStep.CANCELLED) {
                confirmStep = WearConfirmStep.IDLE
                refreshStatus()
            }
        }

        fun onConfirmSend(nowMs: Long = System.currentTimeMillis()) {
            confirmStep = WearConfirmStep.IDLE
            statusHeadline = "Gönderiliyor"
            statusDetail = "SOS hazırlanıyor..."
            userFacingPhase = WearUserFacingPhase.SENDING
            
            viewModelScope.launch {
                try {
                    submitSosViaMesh(nowMs)
                    
                    if (companionTransport.isPhoneReachable()) {
                        val wire = companionCoordinator.buildCreateWire(nowMs)
                        companionCoordinator.submitConfirmed(wire, nowMs)
                    }
                    
                    refreshStatus(nowMs)
                } catch (e: Exception) {
                    statusHeadline = "Hata"
                    statusDetail = "SOS gönderilemedi: ${e.message}"
                    userFacingPhase = WearUserFacingPhase.FAILED
                }
            }
        }

        private suspend fun submitSosViaMesh(nowMs: Long) =
            withContext(Dispatchers.IO) {
                val request =
                    com.sosmesh.android.core.data.sos.SosComposeRequest(
                        sosType = SosType.DIGER,
                        personCount = 1,
                        note = "",
                        location = com.sosmesh.android.core.data.sos.LocationSnapshot(
                            source = com.sosmesh.android.core.data.sos.LocationSource.UNKNOWN,
                        ),
                        languageTag = "tr",
                        nowMs = nowMs,
                        messageIdOverride = null,
                        sender = null,
                    )

                val composed = sosComposer.compose(request)

                outbox.enqueue(
                    EnqueueInput(
                        sosId = composed.message.id,
                        digest = composed.digest,
                        origin = "wear_mesh",
                        encryptedBlobBase64 = composed.encryptedBlobBase64,
                    ),
                    nowMs,
                )

                val l2Bytes = Base64.getDecoder().decode(composed.encryptedBlobBase64)
                meshRuntime.node.addOwn(
                    messageId = composed.message.id,
                    l2Bytes = l2Bytes,
                    packetHash = composed.digest,
                    createdAtMs = nowMs,
                    nowMs = nowMs,
                )

                bleMeshRadio.startPeerDiscovery(foregroundVisible = true)
            }

        fun refreshStatus(nowMs: Long = System.currentTimeMillis()) {
            val display = companionCoordinator.displayState(nowMs)
            userFacingPhase = display.phase
            showsFalseSuccess = display.showsFalseSuccess
            statusHeadline = display.headlineTr
            statusDetail = display.detailTr
        }
    }

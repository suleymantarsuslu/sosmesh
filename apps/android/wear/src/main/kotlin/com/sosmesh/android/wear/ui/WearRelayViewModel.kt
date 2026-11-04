package com.sosmesh.android.wear.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import com.sosmesh.android.wear.mesh.WearMeshCoordinator
import com.sosmesh.android.wear.mesh.WearRelaySettings

class WearRelayViewModel(
    private val coordinator: WearMeshCoordinator,
    private val settings: WearRelaySettings,
) : ViewModel() {
    var isRelayActive by mutableStateOf(settings.isRelayEnabled())
        private set

    init {
        if (settings.isRelayEnabled()) {
            coordinator.startRelay()
            isRelayActive = true
        }
    }

    fun toggleRelay(enabled: Boolean) {
        if (enabled) {
            coordinator.startRelay()
        } else {
            coordinator.stopRelay()
        }
        settings.setRelayEnabled(enabled)
        isRelayActive = enabled
    }
}

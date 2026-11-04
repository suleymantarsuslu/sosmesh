package com.sosmesh.android.wear.ui

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import com.sosmesh.android.wear.mesh.WearMeshCoordinator
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject

@HiltViewModel
class WearRelayViewModel
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
        private val coordinator: WearMeshCoordinator,
    ) : ViewModel() {
        private val prefs = context.getSharedPreferences("wear_relay_prefs", Context.MODE_PRIVATE)
        
        var isRelayActive by mutableStateOf(loadRelayEnabled())
            private set
        
        var errorMessage by mutableStateOf<String?>(null)
            private set
        
        var missingPermissions by mutableStateOf<List<String>>(emptyList())
            private set

        init {
            if (loadRelayEnabled()) {
                val result = coordinator.startRelay()
                if (result.isFailure) {
                    isRelayActive = false
                    saveRelayEnabled(false)
                    errorMessage = result.exceptionOrNull()?.message
                    missingPermissions = coordinator.getMissingPermissions()
                }
            }
        }

        fun toggleRelay(enabled: Boolean) {
            errorMessage = null
            missingPermissions = emptyList()
            
            if (enabled) {
                val result = coordinator.startRelay()
                if (result.isSuccess) {
                    saveRelayEnabled(true)
                    isRelayActive = true
                } else {
                    errorMessage = result.exceptionOrNull()?.message
                    missingPermissions = coordinator.getMissingPermissions()
                    isRelayActive = false
                }
            } else {
                coordinator.stopRelay()
                saveRelayEnabled(false)
                isRelayActive = false
            }
        }
        
        private fun loadRelayEnabled(): Boolean = prefs.getBoolean("relay_enabled", false)
        
        private fun saveRelayEnabled(enabled: Boolean) {
            prefs.edit().putBoolean("relay_enabled", enabled).apply()
        }
    }

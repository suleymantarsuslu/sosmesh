package com.sosmesh.android.ui.settings

import android.content.Context
import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import javax.inject.Inject

data class SettingsUiState(
    val highContrast: Boolean = false,
    val highPowerRadioConsent: Boolean = false,
)

@HiltViewModel
class SettingsViewModel
    @Inject
    constructor(
        @ApplicationContext context: Context,
    ) : ViewModel() {
        private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

        private val _uiState =
            MutableStateFlow(
                SettingsUiState(
                    highContrast = prefs.getBoolean(KEY_HIGH_CONTRAST, false),
                    highPowerRadioConsent = prefs.getBoolean(KEY_HIGH_POWER_RADIO_CONSENT, false),
                ),
            )
        val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

        fun setHighContrast(enabled: Boolean) {
            prefs.edit().putBoolean(KEY_HIGH_CONTRAST, enabled).apply()
            _uiState.update { it.copy(highContrast = enabled) }
        }

        fun setHighPowerRadioConsent(enabled: Boolean) {
            prefs.edit().putBoolean(KEY_HIGH_POWER_RADIO_CONSENT, enabled).apply()
            _uiState.update { it.copy(highPowerRadioConsent = enabled) }
        }

        fun isHighPowerRadioConsentGranted(): Boolean = prefs.getBoolean(KEY_HIGH_POWER_RADIO_CONSENT, false)

        companion object {
            const val PREFS_NAME = "sosmesh_ui_settings"
            const val KEY_HIGH_CONTRAST = "high_contrast"
            const val KEY_HIGH_POWER_RADIO_CONSENT = "high_power_radio_consent"
            private const val PREFS = PREFS_NAME
        }
    }

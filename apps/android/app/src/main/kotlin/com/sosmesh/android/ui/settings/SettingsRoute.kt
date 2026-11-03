package com.sosmesh.android.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.hilt.navigation.compose.hiltViewModel
import com.sosmesh.android.R
import com.sosmesh.android.core.design.components.SosNot112Banner
import com.sosmesh.android.core.design.components.SosScreenScaffold
import com.sosmesh.android.core.design.components.SosScrollableScreenContent
import com.sosmesh.android.core.design.theme.SosSpacing

@Composable
fun SettingsRoute(
    onBack: () -> Unit,
    viewModel: SettingsViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()
    SosScreenScaffold(
        title = stringResource(R.string.settings_title),
        onNavigateBack = onBack,
    ) { contentModifier ->
        SosScrollableScreenContent(contentModifier) {
            SosNot112Banner(
                disclaimerText = stringResource(com.sosmesh.android.core.permissions.R.string.permission_disclaimer_not112),
                showCall112 = true,
            )
            Text(stringResource(R.string.settings_data_control_intro), style = MaterialTheme.typography.bodyMedium)
            RowToggle(
                label = stringResource(R.string.settings_high_contrast),
                checked = state.highContrast,
                onCheckedChange = viewModel::setHighContrast,
            )
            Text(stringResource(R.string.settings_high_power_radio_intro), style = MaterialTheme.typography.bodySmall)
            RowToggle(
                label = stringResource(R.string.settings_high_power_radio_consent),
                checked = state.highPowerRadioConsent,
                onCheckedChange = viewModel::setHighPowerRadioConsent,
            )
            Text(stringResource(R.string.settings_local_data_note), style = MaterialTheme.typography.bodySmall)
            Button(onClick = onBack, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.settings_back))
            }
        }
    }
}

@Composable
private fun RowToggle(
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(SosSpacing.xs)) {
        Text(label, style = MaterialTheme.typography.titleSmall)
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}

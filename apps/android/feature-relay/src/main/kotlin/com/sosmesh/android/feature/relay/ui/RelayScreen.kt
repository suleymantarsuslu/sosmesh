package com.sosmesh.android.feature.relay.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.sosmesh.android.feature.relay.R
import com.sosmesh.android.feature.relay.battery.RelayPauseReason

@Composable
fun RelayScreen(
    state: RelayUiState,
    onToggleRelay: (Boolean) -> Unit,
    onStopAndExit: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(text = stringResource(R.string.relay_title), style = MaterialTheme.typography.headlineMedium)
        Text(
            text = stringResource(R.string.relay_intro),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(modifier = Modifier.height(8.dp))

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors =
                CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                ),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = stringResource(R.string.relay_toggle_label),
                    style = MaterialTheme.typography.titleMedium,
                )
                Switch(checked = state.relayEnabled, onCheckedChange = onToggleRelay)
            }
        }

        Card(
            modifier = Modifier.fillMaxWidth(),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = stringResource(R.string.relay_pending_count, state.pendingUploadCount),
                    style = MaterialTheme.typography.titleMedium,
                )
                Text(
                    text =
                        stringResource(
                            R.string.relay_battery_status,
                            state.batteryLevelPercent,
                            if (state.isCharging) {
                                stringResource(R.string.relay_charging_yes)
                            } else {
                                stringResource(R.string.relay_charging_no)
                            },
                        ),
                )
                Text(
                    text =
                        stringResource(
                            R.string.relay_battery_impact_estimate,
                            state.estimatedBatteryImpactPercentPerHour,
                        ),
                )
                Text(
                    text =
                        stringResource(
                            R.string.relay_policy_summary,
                            state.batteryThresholdPercent,
                            state.hourlyDataLimitMb,
                        ),
                )
            }
        }

        when (state.pauseReason) {
            RelayPauseReason.BatteryBelowThreshold ->
                Text(
                    text = stringResource(R.string.relay_pause_battery),
                    color = MaterialTheme.colorScheme.error,
                )
            RelayPauseReason.HourlyDataLimit ->
                Text(
                    text = stringResource(R.string.relay_pause_hourly_limit),
                    color = MaterialTheme.colorScheme.error,
                )
            RelayPauseReason.UserDisabled -> Unit
            null -> Unit
        }

        Card(
            modifier = Modifier.fillMaxWidth(),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = stringResource(R.string.relay_constraints_title),
                    style = MaterialTheme.typography.titleMedium,
                )
                Text(
                    text = state.systemConstraintSummary,
                    style = MaterialTheme.typography.bodyMedium,
                )
                Text(
                    text = state.systemConstraintDetail,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        Button(
            onClick = onStopAndExit,
            modifier = Modifier.fillMaxWidth().height(56.dp),
        ) {
            Text(stringResource(R.string.relay_stop_exit))
        }
    }
}

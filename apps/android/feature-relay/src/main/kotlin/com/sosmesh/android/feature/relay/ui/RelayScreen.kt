package com.sosmesh.android.feature.relay.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import com.sosmesh.android.core.design.components.SosNot112Banner
import com.sosmesh.android.core.design.components.SosScreenScaffold
import com.sosmesh.android.core.design.components.SosScrollableScreenContent
import com.sosmesh.android.core.design.components.SosStatusCard
import com.sosmesh.android.feature.relay.R
import com.sosmesh.android.feature.relay.battery.RelayPauseReason

@Composable
fun RelayScreen(
    state: RelayUiState,
    onToggleRelay: (Boolean) -> Unit,
    onStopAndExit: () -> Unit,
    onNavigateBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    SosScreenScaffold(
        title = stringResource(R.string.relay_title),
        modifier = modifier,
        onNavigateBack = onNavigateBack,
    ) { contentModifier ->
        SosScrollableScreenContent(contentModifier) {
            Text(text = stringResource(R.string.relay_intro), style = MaterialTheme.typography.bodyMedium)
            SosNot112Banner(
                disclaimerText = stringResource(R.string.relay_not112_disclaimer),
                showCall112 = false,
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(text = stringResource(R.string.relay_toggle_label))
                Switch(checked = state.relayEnabled, onCheckedChange = onToggleRelay)
            }

            SosStatusCard {
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

            SosStatusCard {
                Text(
                    text = stringResource(R.string.relay_constraints_title),
                    style = MaterialTheme.typography.titleSmall,
                )
                Text(text = state.systemConstraintSummary, style = MaterialTheme.typography.bodyMedium)
                Text(text = state.systemConstraintDetail, style = MaterialTheme.typography.bodySmall)
            }

            Button(onClick = onStopAndExit, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.relay_stop_exit))
            }
        }
    }
}

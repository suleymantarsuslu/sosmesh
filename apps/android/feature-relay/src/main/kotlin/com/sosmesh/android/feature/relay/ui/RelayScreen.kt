package com.sosmesh.android.feature.relay.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Sensors
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import com.sosmesh.android.core.design.components.SosBadge
import com.sosmesh.android.core.design.components.SosBadgeKind
import com.sosmesh.android.core.design.components.SosCard
import com.sosmesh.android.core.design.components.SosHeaderGlyph
import com.sosmesh.android.core.design.components.SosIconCard
import com.sosmesh.android.core.design.components.SosKeyValueRow
import com.sosmesh.android.core.design.components.SosNot112Banner
import com.sosmesh.android.core.design.components.SosScreenScaffold
import com.sosmesh.android.core.design.components.SosScrollableScreenContent
import com.sosmesh.android.core.design.components.SosSecondaryButton
import com.sosmesh.android.core.design.components.SosToggleRow
import com.sosmesh.android.core.design.theme.SosIosColors
import com.sosmesh.android.core.design.theme.SosSpacing
import com.sosmesh.android.feature.relay.R
import com.sosmesh.android.feature.relay.battery.RelayPauseReason

@Composable
fun RelayScreen(
    state: RelayUiState,
    onToggleRelay: (Boolean) -> Unit,
    onStopAndExit: () -> Unit,
    modifier: Modifier = Modifier,
) {
    SosScreenScaffold(
        title = stringResource(R.string.relay_title),
        modifier = modifier,
        showLogoInTopBar = false,
    ) { contentModifier ->
        SosScrollableScreenContent(contentModifier) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(top = SosSpacing.xs),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(SosSpacing.xs),
            ) {
                SosHeaderGlyph(icon = Icons.Filled.Sensors)
                RelayStatusBadge(state)
            }

            SosCard {
                SosToggleRow(
                    title = stringResource(R.string.relay_toggle_label),
                    description = stringResource(R.string.relay_intro),
                    checked = state.relayEnabled,
                    onCheckedChange = onToggleRelay,
                )
            }

            SosIconCard(
                icon = Icons.Filled.Warning,
                iconTint = SosIosColors.WarningOrange,
            ) {
                Text(
                    text = stringResource(R.string.relay_battery_warning),
                    style = MaterialTheme.typography.bodyMedium,
                )
                Text(
                    text =
                        stringResource(
                            R.string.relay_battery_impact_estimate,
                            state.estimatedBatteryImpactPercentPerHour,
                        ),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            when (state.pauseReason) {
                RelayPauseReason.BatteryBelowThreshold ->
                    PauseCard(stringResource(R.string.relay_pause_battery))
                RelayPauseReason.HourlyDataLimit ->
                    PauseCard(stringResource(R.string.relay_pause_hourly_limit))
                RelayPauseReason.UserDisabled -> Unit
                null -> Unit
            }

            SosCard {
                Text(
                    text = stringResource(R.string.relay_diag_title),
                    style = MaterialTheme.typography.titleMedium,
                )
                SosKeyValueRow(
                    label = stringResource(R.string.relay_diag_pending),
                    value = state.pendingUploadCount.toString(),
                )
                SosKeyValueRow(
                    label = stringResource(R.string.relay_diag_battery),
                    value =
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
                SosKeyValueRow(
                    label = stringResource(R.string.relay_diag_threshold),
                    value = "${state.batteryThresholdPercent}%",
                )
                SosKeyValueRow(
                    label = stringResource(R.string.relay_diag_data_cap),
                    value = "~${state.hourlyDataLimitMb} MB",
                )
            }

            SosCard {
                Text(
                    text = stringResource(R.string.relay_constraints_title),
                    style = MaterialTheme.typography.titleMedium,
                )
                Text(text = state.systemConstraintSummary, style = MaterialTheme.typography.bodyMedium)
                Text(
                    text = state.systemConstraintDetail,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            SosIconCard(icon = Icons.Filled.Info) {
                Text(
                    text = stringResource(R.string.relay_how_it_works),
                    style = MaterialTheme.typography.titleMedium,
                )
                Text(
                    text = stringResource(R.string.relay_policy_summary, state.batteryThresholdPercent, state.hourlyDataLimitMb),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            SosNot112Banner(
                disclaimerText = stringResource(R.string.relay_not112_disclaimer),
                showCall112 = false,
            )

            SosSecondaryButton(
                text = stringResource(R.string.relay_stop_exit),
                onClick = onStopAndExit,
            )
        }
    }
}

@Composable
private fun RelayStatusBadge(state: RelayUiState) {
    val (kind, label) =
        when {
            !state.relayEnabled -> SosBadgeKind.Neutral to R.string.relay_status_off
            state.pauseReason == RelayPauseReason.BatteryBelowThreshold ||
                state.pauseReason == RelayPauseReason.HourlyDataLimit ->
                SosBadgeKind.Warning to R.string.relay_status_paused
            else -> SosBadgeKind.Success to R.string.relay_status_active
        }
    SosBadge(kind = kind, text = stringResource(label))
}

@Composable
private fun PauseCard(text: String) {
    SosIconCard(
        icon = Icons.Filled.Warning,
        iconTint = SosIosColors.WarningOrange,
        highlighted = true,
        accent = SosIosColors.WarningOrange,
    ) {
        Text(text = text, style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.Start)
    }
}

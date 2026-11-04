package com.sosmesh.android.feature.status.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.sosmesh.android.core.design.components.SosBadge
import com.sosmesh.android.core.design.components.SosBadgeKind
import com.sosmesh.android.core.design.components.SosEmptyState
import com.sosmesh.android.core.design.components.SosNot112Banner
import com.sosmesh.android.core.design.components.SosScreenScaffold
import com.sosmesh.android.core.design.components.SosScrollableScreenContent
import com.sosmesh.android.core.design.components.SosStatusCard
import com.sosmesh.android.core.design.components.SosTimelineStep
import com.sosmesh.android.core.design.theme.SosIosColors
import com.sosmesh.android.core.design.theme.SosSpacing
import com.sosmesh.android.feature.status.R
import com.sosmesh.android.feature.status.StatusHopProgress
import com.sosmesh.android.feature.status.StatusTimelineFormatter
import com.sosmesh.android.feature.status.StatusUiState
import com.sosmesh.contracts.transport.OutboxEntryMeta

@Composable
fun StatusScreen(
    state: StatusUiState,
    modifier: Modifier = Modifier,
) {
    SosScreenScaffold(
        title = stringResource(R.string.status_title),
        modifier = modifier,
        showLogoInTopBar = false,
    ) { contentModifier ->
        SosScrollableScreenContent(contentModifier) {
            if (state.offline) {
                SosBadge(
                    kind = SosBadgeKind.Warning,
                    text = stringResource(R.string.status_offline_badge),
                )
            }
            SosNot112Banner(disclaimerText = stringResource(R.string.status_not112_disclaimer))
            if (state.entries.isEmpty()) {
                SosEmptyState(message = stringResource(R.string.status_empty))
            } else {
                state.entries.forEach { entry ->
                    StatusEntryTimeline(entry = entry)
                }
            }
        }
    }
}

@Composable
private fun StatusEntryTimeline(entry: OutboxEntryMeta) {
    SosStatusCard {
        Column(verticalArrangement = Arrangement.spacedBy(SosSpacing.xs)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(SosSpacing.xs),
                ) {
                    Icon(
                        imageVector = Icons.Filled.Email,
                        contentDescription = null,
                        tint = SosIosColors.AccentBlueText,
                        modifier = Modifier.size(20.dp),
                    )
                    Text(
                        stringResource(R.string.status_evidence_created, StatusTimelineFormatter.formatUtcMinute(entry.createdAtMs)),
                        style = MaterialTheme.typography.titleSmall,
                    )
                }
                DeliveryBadge(entry.state)
            }
            Text(
                stringResource(R.string.status_evidence_updated, StatusTimelineFormatter.formatUtcMinute(entry.updatedAtMs)),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            entry.lastError?.let { err ->
                Text(
                    stringResource(R.string.status_evidence_last_error, err),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                )
            }
            Column(modifier = Modifier.padding(vertical = SosSpacing.xs)) {
                HopRow(entry, "LOCAL_SAVED", stringResource(R.string.status_timeline_step_1))
                HopRow(entry, "PEER_RECEIVED", stringResource(R.string.status_timeline_step_2))
                HopRow(entry, "SERVER_ACCEPTED", stringResource(R.string.status_timeline_step_3))
                HopRow(entry, "OPERATOR_SEEN", stringResource(R.string.status_timeline_step_4))
                HopRow(entry, "CASE_IN_PROGRESS", stringResource(R.string.status_timeline_step_5))
            }
            val description =
                when (entry.state) {
                    "LOCAL_SAVED" -> R.string.status_timeline_desc_local
                    "PEER_RECEIVED" -> R.string.status_timeline_desc_peer
                    "SERVER_ACCEPTED" -> R.string.status_timeline_desc_server
                    "OPERATOR_SEEN" -> R.string.status_timeline_desc_operator
                    "CASE_IN_PROGRESS" -> R.string.status_timeline_desc_case
                    "FAILED" -> R.string.status_timeline_failed
                    "EXPIRED" -> R.string.status_timeline_expired
                    else -> null
                }
            if (description != null) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(SosSpacing.xs),
                    verticalAlignment = Alignment.Top,
                ) {
                    Icon(
                        imageVector = Icons.Filled.Info,
                        contentDescription = null,
                        tint = SosIosColors.LabelTertiary,
                        modifier = Modifier.size(16.dp),
                    )
                    Text(
                        stringResource(description),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun DeliveryBadge(state: String) {
    val (kind, label) =
        when (state) {
            "LOCAL_SAVED" -> SosBadgeKind.Pending to R.string.status_badge_local
            "PEER_RECEIVED" -> SosBadgeKind.Pending to R.string.status_badge_peer
            "SERVER_ACCEPTED" -> SosBadgeKind.Success to R.string.status_badge_server
            "OPERATOR_SEEN" -> SosBadgeKind.Success to R.string.status_badge_operator
            "CASE_IN_PROGRESS" -> SosBadgeKind.Success to R.string.status_badge_case
            "FAILED" -> SosBadgeKind.Error to R.string.status_badge_failed
            "EXPIRED" -> SosBadgeKind.Warning to R.string.status_badge_expired
            else -> return
        }
    SosBadge(kind = kind, text = stringResource(label))
}

@Composable
private fun HopRow(
    entry: OutboxEntryMeta,
    hopState: String,
    label: String,
) {
    val reached = StatusHopProgress.isHopReached(entry.state, hopState)
    SosTimelineStep(label = label, reached = reached)
}

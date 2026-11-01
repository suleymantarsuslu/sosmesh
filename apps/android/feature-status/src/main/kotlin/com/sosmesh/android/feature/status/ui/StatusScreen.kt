package com.sosmesh.android.feature.status.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.sosmesh.android.feature.status.R
import com.sosmesh.android.feature.status.StatusUiState
import com.sosmesh.contracts.transport.OutboxEntryMeta

@Composable
fun StatusScreen(
    state: StatusUiState,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (state.offline) {
            Surface(color = MaterialTheme.colorScheme.errorContainer, modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = stringResource(R.string.status_offline_badge),
                    modifier = Modifier.padding(12.dp),
                )
            }
        }
        Text(stringResource(R.string.status_title), style = MaterialTheme.typography.headlineSmall)
        Text(stringResource(R.string.status_not112_disclaimer), style = MaterialTheme.typography.bodySmall)
        if (state.entries.isEmpty()) {
            Text(stringResource(R.string.status_empty))
        } else {
            state.entries.forEach { entry ->
                StatusEntryTimeline(entry = entry)
            }
        }
    }
}

@Composable
private fun StatusEntryTimeline(entry: OutboxEntryMeta) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        TimelineRow(active = entry.state == "LOCAL_SAVED", label = stringResource(R.string.status_timeline_step_1))
        TimelineRow(active = entry.state == "PEER_RECEIVED", label = stringResource(R.string.status_timeline_step_2))
        TimelineRow(active = entry.state == "SERVER_ACCEPTED", label = stringResource(R.string.status_timeline_step_3))
        TimelineRow(active = entry.state == "OPERATOR_SEEN", label = stringResource(R.string.status_timeline_step_4))
        TimelineRow(
            active = entry.state == "CASE_IN_PROGRESS",
            label = stringResource(R.string.status_timeline_step_5),
        )
        when (entry.state) {
            "LOCAL_SAVED" -> Text(stringResource(R.string.status_timeline_desc_local))
            "PEER_RECEIVED" -> Text(stringResource(R.string.status_timeline_desc_peer))
            "SERVER_ACCEPTED" -> Text(stringResource(R.string.status_timeline_desc_server))
            "OPERATOR_SEEN" -> Text(stringResource(R.string.status_timeline_desc_operator))
            "CASE_IN_PROGRESS" -> Text(stringResource(R.string.status_timeline_desc_case))
            "FAILED" -> Text(stringResource(R.string.status_timeline_failed))
            "EXPIRED" -> Text(stringResource(R.string.status_timeline_expired))
        }
    }
}

@Composable
private fun TimelineRow(
    active: Boolean,
    label: String,
) {
    val style =
        if (active) {
            MaterialTheme.typography.titleSmall
        } else {
            MaterialTheme.typography.bodySmall
        }
    Text(text = label, style = style)
}

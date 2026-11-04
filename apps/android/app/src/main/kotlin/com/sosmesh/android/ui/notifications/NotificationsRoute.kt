package com.sosmesh.android.ui.notifications

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.hilt.navigation.compose.hiltViewModel
import com.sosmesh.android.R
import com.sosmesh.android.core.data.notifications.NotificationHistoryItem
import com.sosmesh.android.core.data.notifications.NotificationType
import com.sosmesh.android.core.design.components.SosBadge
import com.sosmesh.android.core.design.components.SosBadgeKind
import com.sosmesh.android.core.design.components.SosScreenScaffold
import com.sosmesh.android.core.design.components.SosScrollableScreenContent
import com.sosmesh.android.core.design.components.SosStatusCard
import com.sosmesh.android.core.design.theme.SosSpacing
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun NotificationsRoute(
    onNavigateToRelay: () -> Unit,
    onBack: () -> Unit,
    viewModel: NotificationsViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.markAllRead()
    }

    NotificationsScreen(
        state = state,
        onClearAll = { viewModel.clearAll() },
        onItemClick = { item ->
            when (item.type) {
                NotificationType.BROADCAST -> viewModel.toggleExpanded(item.id)
                NotificationType.INCOMING_SOS -> onNavigateToRelay()
            }
        },
        onBack = onBack,
    )
}

@Composable
private fun NotificationsScreen(
    state: NotificationsUiState,
    onClearAll: () -> Unit,
    onItemClick: (NotificationHistoryItem) -> Unit,
    onBack: () -> Unit,
) {
    SosScreenScaffold(
        title = stringResource(R.string.notifications_title),
        onBack = onBack,
        actions = {
            if (state.items.isNotEmpty()) {
                IconButton(onClick = onClearAll) {
                    Icon(
                        imageVector = Icons.Filled.Delete,
                        contentDescription = stringResource(R.string.notifications_clear_all),
                    )
                }
            }
        },
    ) { contentModifier ->
        if (state.items.isEmpty()) {
            Box(
                modifier = contentModifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = stringResource(R.string.notifications_empty),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            LazyColumn(
                modifier = contentModifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(SosSpacing.xs),
            ) {
                items(state.items, key = { it.id }) { item ->
                    NotificationCard(
                        item = item,
                        isExpanded = state.expandedItemId == item.id,
                        onClick = { onItemClick(item) },
                    )
                }
            }
        }
    }
}

@Composable
private fun NotificationCard(
    item: NotificationHistoryItem,
    isExpanded: Boolean,
    onClick: () -> Unit,
) {
    SosStatusCard(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(horizontal = SosSpacing.md),
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(SosSpacing.xs),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top,
            ) {
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(SosSpacing.xs),
                ) {
                    Text(
                        text = item.title,
                        style = MaterialTheme.typography.titleMedium,
                        maxLines = if (isExpanded) Int.MAX_VALUE else 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (item.severity != null) {
                        SosBadge(
                            kind =
                                when (item.severity) {
                                    "critical" -> SosBadgeKind.Error
                                    "warning" -> SosBadgeKind.Warning
                                    else -> SosBadgeKind.Neutral
                                },
                            text = item.severity,
                        )
                    }
                }
                Text(
                    text = formatTimestamp(item.timestampMs),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                text = item.body,
                style = MaterialTheme.typography.bodyMedium,
                maxLines = if (isExpanded) Int.MAX_VALUE else 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

private fun formatTimestamp(timestampMs: Long): String {
    val date = Date(timestampMs)
    val now = Date()
    val diff = now.time - date.time
    val hours = diff / (1000 * 60 * 60)
    val days = hours / 24

    return when {
        hours < 1 -> {
            val minutes = diff / (1000 * 60)
            "${minutes}m"
        }
        hours < 24 -> "${hours}h"
        days < 7 -> "${days}d"
        else -> {
            val format = SimpleDateFormat("MMM d", Locale.getDefault())
            format.format(date)
        }
    }
}

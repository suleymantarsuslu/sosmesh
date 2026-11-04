package com.sosmesh.android.wear.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.ScalingLazyListAnchorType
import androidx.wear.compose.foundation.lazy.ScalingLazyListScope
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.CircularProgressIndicator
import androidx.wear.compose.material.Icon
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.PositionIndicator
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.TimeText
import androidx.wear.compose.material.Vignette
import androidx.wear.compose.material.VignettePosition
import com.sosmesh.android.core.wear.companion.sync.WearUserFacingPhase
import com.sosmesh.android.wear.R
import kotlinx.coroutines.delay

private const val CANCELLED_AUTO_DISMISS_MILLIS = 3_000L

@Composable
private fun WearListScreen(content: ScalingLazyListScope.() -> Unit) {
    val listState = rememberScalingLazyListState()
    Scaffold(
        timeText = { TimeText() },
        vignette = { Vignette(vignettePosition = VignettePosition.TopAndBottom) },
        positionIndicator = { PositionIndicator(scalingLazyListState = listState) },
    ) {
        ScalingLazyColumn(
            modifier = Modifier.fillMaxSize(),
            state = listState,
            anchorType = ScalingLazyListAnchorType.ItemStart,
            autoCentering = null,
            contentPadding = PaddingValues(start = 12.dp, end = 12.dp, top = 32.dp, bottom = 30.dp),
            content = content,
        )
    }
}

@Composable
private fun StatusBadge(
    tone: WearStatusTone?,
    iconRes: Int,
    modifier: Modifier = Modifier,
) {
    val color = tone?.color() ?: WearSosPalette.TextMuted
    val description = stringResource(R.string.status_icon_description)
    Box(
        modifier =
            modifier
                .size(44.dp)
                .clip(CircleShape)
                .background(color.copy(alpha = 0.18f))
                .semantics { contentDescription = description },
        contentAlignment = Alignment.Center,
    ) {
        if (tone == WearStatusTone.PROGRESS) {
            CircularProgressIndicator(
                modifier = Modifier.size(30.dp),
                indicatorColor = color,
                trackColor = color.copy(alpha = 0.25f),
                strokeWidth = 3.dp,
            )
        } else {
            Icon(
                painter = painterResource(iconRes),
                contentDescription = null,
                tint = color,
                modifier = Modifier.size(24.dp),
            )
        }
    }
}

@Composable
internal fun WearConfirmScreen(
    onSend: () -> Unit,
    onCancel: () -> Unit,
) {
    val gate = remember { WearSendGate() }
    val touchExploration = isTouchExplorationEnabled()
    LaunchedEffect(Unit) {
        delay(SEND_ARM_DELAY_MILLIS)
        gate.armed = true
    }
    Box(modifier = Modifier.fillMaxSize().freshPressGate(gate)) {
        WearConfirmContent(
            onSend = {
                if (gate.consume(touchExploration)) {
                    onSend()
                }
            },
            onCancel = onCancel,
        )
    }
}

@Composable
private fun WearConfirmContent(
    onSend: () -> Unit,
    onCancel: () -> Unit,
) {
    WearListScreen {
        item {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier.semantics(mergeDescendants = true) { heading() }.testTag("wear_confirm_title"),
            ) {
                Icon(
                    painter = painterResource(R.drawable.ic_wear_warning),
                    contentDescription = null,
                    tint = WearStatusTone.ERROR.color(),
                    modifier = Modifier.size(20.dp),
                )
                Text(
                    text = stringResource(R.string.confirm_title),
                    style = MaterialTheme.typography.title3,
                    textAlign = TextAlign.Center,
                )
            }
        }
        item {
            Text(
                text = stringResource(R.string.confirm_detail),
                style = MaterialTheme.typography.caption2,
                color = WearSosPalette.TextMuted,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(bottom = 4.dp),
            )
        }
        item {
            Chip(
                onClick = onSend,
                label = {
                    Text(
                        text = stringResource(R.string.confirm_send),
                        fontWeight = FontWeight.Bold,
                    )
                },
                icon = {
                    Icon(
                        painter = painterResource(R.drawable.ic_wear_send),
                        contentDescription = null,
                        modifier = Modifier.size(20.dp),
                    )
                },
                colors =
                    ChipDefaults.primaryChipColors(
                        backgroundColor = WearSosPalette.EmergencyRed,
                        contentColor = WearSosPalette.OnEmergencyRed,
                    ),
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 52.dp)
                        .testTag("wear_confirm_send"),
            )
        }
        item {
            Chip(
                onClick = onCancel,
                label = { Text(text = stringResource(R.string.confirm_cancel)) },
                icon = {
                    Icon(
                        painter = painterResource(R.drawable.ic_wear_close),
                        contentDescription = null,
                        modifier = Modifier.size(20.dp),
                    )
                },
                colors = ChipDefaults.secondaryChipColors(),
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 52.dp)
                        .testTag("wear_confirm_cancel"),
            )
        }
    }
}

@Composable
internal fun WearCancelledScreen(onDone: () -> Unit) {
    LaunchedEffect(Unit) {
        delay(CANCELLED_AUTO_DISMISS_MILLIS)
        onDone()
    }
    WearListScreen {
        item { StatusBadge(tone = null, iconRes = R.drawable.ic_wear_close) }
        item {
            Text(
                text = stringResource(R.string.not_sent),
                style = MaterialTheme.typography.title3,
                textAlign = TextAlign.Center,
                modifier =
                    Modifier
                        .padding(top = 4.dp)
                        .semantics { heading() }
                        .testTag("wear_status_headline"),
            )
        }
        item {
            Text(
                text = stringResource(R.string.cancelled_detail),
                style = MaterialTheme.typography.caption2,
                color = WearSosPalette.TextMuted,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(bottom = 6.dp),
            )
        }
        item { DoneChip(onDone) }
    }
}

@Composable
internal fun WearResultScreen(
    phase: WearUserFacingPhase,
    onDone: () -> Unit,
) {
    val copy = phase.toStatusCopy()
    val haptic = LocalHapticFeedback.current
    LaunchedEffect(phase) {
        haptic.performHapticFeedback(HapticFeedbackType.LongPress)
    }
    val iconRes =
        when (copy.tone) {
            WearStatusTone.SAVED, WearStatusTone.READY -> R.drawable.ic_wear_check
            else -> R.drawable.ic_wear_warning
        }
    WearListScreen {
        item { StatusBadge(tone = copy.tone, iconRes = iconRes) }
        item {
            Text(
                text = stringResource(copy.headline),
                style = MaterialTheme.typography.title3,
                textAlign = TextAlign.Center,
                modifier =
                    Modifier
                        .padding(top = 4.dp)
                        .semantics { heading() }
                        .testTag("wear_status_headline"),
            )
        }
        item {
            Text(
                text = stringResource(copy.detail),
                style = MaterialTheme.typography.caption2,
                color = WearSosPalette.TextMuted,
                textAlign = TextAlign.Center,
                modifier =
                    Modifier
                        .padding(bottom = 6.dp)
                        .testTag("wear_status_detail"),
            )
        }
        item { DoneChip(onDone) }
        item { Not112Caption() }
    }
}

@Composable
private fun DoneChip(onDone: () -> Unit) {
    Chip(
        onClick = onDone,
        label = { Text(text = stringResource(R.string.action_done)) },
        icon = {
            Icon(
                painter = painterResource(R.drawable.ic_wear_check),
                contentDescription = null,
                modifier = Modifier.size(20.dp),
            )
        },
        colors = ChipDefaults.secondaryChipColors(),
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 52.dp)
                .testTag("wear_done"),
    )
}

@Composable
private fun Not112Caption() {
    val context = androidx.compose.ui.platform.LocalContext.current
    val emergencyNumber = com.sosmesh.android.core.design.emergency.EmergencyNumberProvider.getEmergencyNumber(context)
    Text(
        text = stringResource(R.string.not112, emergencyNumber),
        style = MaterialTheme.typography.caption3,
        color = WearSosPalette.TextMuted,
        textAlign = TextAlign.Center,
        modifier =
            Modifier
                .padding(top = 6.dp)
                .testTag("wear_not112_disclaimer"),
    )
}

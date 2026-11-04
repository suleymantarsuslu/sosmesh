package com.sosmesh.android.wear.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.ScalingLazyListAnchorType
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.Icon
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.PositionIndicator
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.TimeText
import androidx.wear.compose.material.ToggleChip
import androidx.wear.compose.material.ToggleChipDefaults
import androidx.wear.compose.material.Vignette
import androidx.wear.compose.material.VignettePosition
import com.sosmesh.android.wear.R

@Composable
fun WearRelayScreen(
    isRelayActive: Boolean,
    onToggleRelay: (Boolean) -> Unit,
    onBack: () -> Unit,
) {
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
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            item {
                Text(
                    text = stringResource(R.string.relay_title),
                    style = MaterialTheme.typography.title3,
                    textAlign = TextAlign.Center,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .semantics { heading() },
                )
            }
            item {
                Text(
                    text = stringResource(R.string.relay_detail),
                    style = MaterialTheme.typography.caption2,
                    color = WearSosPalette.TextMuted,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(bottom = 4.dp),
                )
            }
            item {
                ToggleChip(
                    checked = isRelayActive,
                    onCheckedChange = onToggleRelay,
                    label = {
                        Text(
                            text =
                                stringResource(
                                    if (isRelayActive) R.string.relay_running else R.string.relay_stopped,
                                ),
                            fontWeight = FontWeight.Bold,
                        )
                    },
                    toggleControl = {
                        Icon(
                            imageVector =
                                ToggleChipDefaults.switchIcon(
                                    checked = isRelayActive,
                                ),
                            contentDescription = null,
                        )
                    },
                    colors =
                        ToggleChipDefaults.toggleChipColors(
                            checkedToggleControlColor = WearSosPalette.EmergencyRed,
                        ),
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .heightIn(min = 52.dp),
                )
            }
            item {
                Chip(
                    onClick = onBack,
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
                            .heightIn(min = 52.dp),
                )
            }
        }
    }
}

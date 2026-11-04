package com.sosmesh.android.wear.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.CurvedDirection
import androidx.wear.compose.foundation.CurvedLayout
import androidx.wear.compose.foundation.CurvedTextStyle
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.TimeText
import androidx.wear.compose.material.Vignette
import androidx.wear.compose.material.VignettePosition
import androidx.wear.compose.material.curvedText
import com.sosmesh.android.core.wear.companion.sync.WearUserFacingPhase
import com.sosmesh.android.wear.R

@Composable
internal fun WearHomeScreen(
    phase: WearUserFacingPhase,
    isAmbient: Boolean,
    onHoldComplete: () -> Unit,
) {
    val copy = phase.toStatusCopy()
    var holding by remember { mutableStateOf(false) }
    val not112 = stringResource(R.string.not112)
    val not112Color = if (isAmbient) WearAmbientUiPolicy.primaryText(true) else WearSosPalette.TextMuted
    Scaffold(
        timeText = { TimeText() },
        vignette = {
            if (!isAmbient) {
                Vignette(vignettePosition = VignettePosition.TopAndBottom)
            }
        },
    ) {
        Column(
            modifier = Modifier.fillMaxSize().padding(top = 26.dp, bottom = 22.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            StatusChip(copy = copy, isAmbient = isAmbient)
            Spacer(Modifier.height(4.dp))
            WearSosHoldButton(
                isAmbient = isAmbient,
                onHoldComplete = onHoldComplete,
                onPressedChange = { holding = it },
            )
            if (!WearAmbientUiPolicy.hideSecondaryDetailInAmbient(isAmbient)) {
                val line =
                    when {
                        holding -> R.string.sos_holding
                        phase == WearUserFacingPhase.IDLE -> R.string.sos_hold_hint
                        else -> copy.detail
                    }
                Text(
                    text = stringResource(line),
                    style = MaterialTheme.typography.caption3,
                    color = WearSosPalette.TextMuted,
                    textAlign = TextAlign.Center,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier =
                        Modifier
                            .widthIn(max = 140.dp)
                            .padding(top = 4.dp)
                            .testTag("wear_status_detail"),
                )
            }
        }
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .semantics { contentDescription = not112 }
                    .testTag("wear_not112_disclaimer"),
        ) {
            CurvedLayout(
                anchor = 90f,
                angularDirection = CurvedDirection.Angular.Reversed,
            ) {
                curvedText(
                    text = not112,
                    style =
                        CurvedTextStyle(
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Medium,
                            color = not112Color,
                        ),
                )
            }
        }
    }
}

@Composable
private fun StatusChip(
    copy: WearStatusCopy,
    isAmbient: Boolean,
) {
    val shape = RoundedCornerShape(50)
    val tone = if (isAmbient) Color(0xFFBDBDBD) else copy.tone.color()
    Row(
        modifier =
            Modifier
                .widthIn(max = 150.dp)
                .clip(shape)
                .then(
                    if (isAmbient) {
                        Modifier
                    } else {
                        Modifier
                            .background(WearSosPalette.Surface)
                            .border(1.dp, WearSosPalette.Outline, shape)
                    },
                )
                .padding(horizontal = 10.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(tone),
        )
        Text(
            text = stringResource(copy.headline),
            style = MaterialTheme.typography.caption2,
            fontWeight = FontWeight.SemiBold,
            color = WearAmbientUiPolicy.primaryText(isAmbient),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.testTag("wear_status_headline"),
        )
    }
}

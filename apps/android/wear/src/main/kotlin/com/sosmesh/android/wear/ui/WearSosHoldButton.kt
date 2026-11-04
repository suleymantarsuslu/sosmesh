package com.sosmesh.android.wear.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Icon
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import com.sosmesh.android.wear.R
import kotlinx.coroutines.launch

private const val HOLD_MILLIS = 1_200

/**
 * Large circular SOS button with a hold-to-start ring (same look as phone/iOS: emergency red,
 * warning glyph, "SOS"). Completing the hold only opens the confirmation step; nothing is sent.
 */
@Composable
internal fun WearSosHoldButton(
    isAmbient: Boolean,
    onHoldComplete: () -> Unit,
    modifier: Modifier = Modifier,
    onPressedChange: (Boolean) -> Unit = {},
    diameter: Dp = 96.dp,
) {
    val progress = remember { Animatable(0f) }
    val scope = rememberCoroutineScope()
    val haptic = LocalHapticFeedback.current
    var pressed by remember { mutableStateOf(false) }
    val description = stringResource(R.string.sos_button_description)
    val actionLabel = stringResource(R.string.sos_button_action)
    val fillBrush =
        Brush.linearGradient(
            colors = listOf(WearSosPalette.EmergencyRed, WearSosPalette.EmergencyRedDeep),
        )
    val textColor = WearAmbientUiPolicy.primaryText(isAmbient)
    val ringColor = WearAmbientUiPolicy.sosBackground(isAmbient)

    Box(
        modifier =
            modifier
                .size(diameter)
                .scale(if (pressed) 0.96f else 1f)
                .semantics(mergeDescendants = true) {
                    contentDescription = description
                    role = Role.Button
                    onClick(label = actionLabel) {
                        onHoldComplete()
                        true
                    }
                }
                .testTag("wear_sos_touch_target"),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier =
                Modifier
                    .size(diameter - 12.dp)
                    .clip(CircleShape)
                    .then(
                        if (isAmbient) {
                            Modifier
                        } else {
                            Modifier
                                .background(fillBrush)
                                .pointerInput(Unit) {
                                    detectTapGestures(
                                        onPress = {
                                            pressed = true
                                            onPressedChange(true)
                                            val hold =
                                                scope.launch {
                                                    progress.animateTo(1f, tween(HOLD_MILLIS, easing = LinearEasing))
                                                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                                }
                                            val released = tryAwaitRelease()
                                            pressed = false
                                            onPressedChange(false)
                                            // The confirmation opens only after the finger is lifted, so the hold
                                            // gesture can never overlap the confirmation screen.
                                            val holdCompleted = hold.isCompleted && !hold.isCancelled
                                            if (!holdCompleted) {
                                                hold.cancel()
                                            }
                                            if (released && holdCompleted) {
                                                onHoldComplete()
                                            }
                                            scope.launch { progress.animateTo(0f, tween(180)) }
                                        },
                                    )
                                }
                        },
                    ),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    painter = painterResource(R.drawable.ic_wear_warning),
                    contentDescription = null,
                    tint = textColor,
                    modifier = Modifier.size(22.dp),
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = stringResource(R.string.sos_label),
                    color = textColor,
                    fontSize = 26.sp,
                    style = MaterialTheme.typography.title1,
                )
            }
        }
        Canvas(modifier = Modifier.size(diameter)) {
            val stroke = 5.dp.toPx()
            val inset = stroke / 2f
            val arcSize = Size(size.width - stroke, size.height - stroke)
            val topLeft = Offset(inset, inset)
            drawArc(
                color = if (isAmbient) ringColor else WearSosPalette.EmergencyRed.copy(alpha = 0.28f),
                startAngle = 0f,
                sweepAngle = 360f,
                useCenter = false,
                topLeft = topLeft,
                size = arcSize,
                style = Stroke(width = if (isAmbient) 2.dp.toPx() else stroke),
            )
            if (!isAmbient && progress.value > 0f) {
                drawArc(
                    color = Color.White,
                    startAngle = -90f,
                    sweepAngle = 360f * progress.value,
                    useCenter = false,
                    topLeft = topLeft,
                    size = arcSize,
                    style = Stroke(width = stroke, cap = StrokeCap.Round),
                )
            }
        }
    }
}

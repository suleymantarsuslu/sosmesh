package com.sosmesh.android.core.design.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.sosmesh.android.core.design.theme.SosIosColors
import com.sosmesh.android.core.design.theme.SosShapes
import com.sosmesh.android.core.design.theme.SosSpacing

/** Large SOS button, iOS style: red gradient, warning glyph, soft red glow, 0.98 press scale. */
@Composable
fun SosExpressSosButton(
    label: String,
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    testTag: String = "home_express_sos_button",
) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(targetValue = if (pressed) 0.98f else 1f, label = "sosPressScale")
    val red = SosIosColors.EmergencyRed
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .scale(scale)
                .shadow(
                    elevation = 12.dp,
                    shape = SosShapes.sosButton,
                    ambientColor = red.copy(alpha = 0.4f),
                    spotColor = red.copy(alpha = 0.4f),
                )
                .clip(SosShapes.sosButton)
                .background(
                    Brush.linearGradient(listOf(red, red.copy(alpha = 0.85f).compositeOver(Color.Black))),
                )
                .clickable(interactionSource = interaction, indication = null, onClick = onClick)
                .defaultMinSize(minHeight = SosSpacing.touchMin)
                .padding(vertical = SosSpacing.lg)
                .testTag(testTag)
                .semantics {
                    this.contentDescription = contentDescription
                    role = Role.Button
                },
        horizontalArrangement = Arrangement.spacedBy(SosSpacing.sm, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(imageVector = Icons.Filled.Warning, contentDescription = null, tint = Color.White, modifier = Modifier.size(32.dp))
        Text(text = label, style = MaterialTheme.typography.displayLarge, color = Color.White)
    }
}

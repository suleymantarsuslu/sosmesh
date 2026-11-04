package com.sosmesh.android.core.design.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.res.stringResource
import com.sosmesh.android.core.design.R
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.sosmesh.android.core.design.theme.SosIosColors
import com.sosmesh.android.core.design.theme.SosShapes
import com.sosmesh.android.core.design.theme.SosSpacing

/** iOS SOSCard: black surface on the grouped background, 12dp radius; highlighted tints it accent blue. */
@Composable
fun SosCard(
    modifier: Modifier = Modifier,
    highlighted: Boolean = false,
    accent: Color = SosIosColors.AccentBlue,
    content: @Composable ColumnScope.() -> Unit,
) {
    val base = SosIosColors.CardBackground
    val container = if (highlighted) accent.copy(alpha = 0.12f).compositeOver(base) else base
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = SosShapes.card,
        color = container,
        contentColor = MaterialTheme.colorScheme.onSurface,
        border = if (highlighted) BorderStroke(1.dp, accent.copy(alpha = 0.35f)) else null,
    ) {
        Column(
            modifier = Modifier.padding(SosSpacing.md),
            verticalArrangement = Arrangement.spacedBy(SosSpacing.xs),
            content = content,
        )
    }
}

internal fun Color.compositeOver(background: Color): Color {
    val a = alpha
    return Color(
        red = red * a + background.red * (1f - a),
        green = green * a + background.green * (1f - a),
        blue = blue * a + background.blue * (1f - a),
        alpha = 1f,
    )
}

enum class SosBadgeKind(val color: Color, val icon: ImageVector) {
    Success(SosIosColors.SuccessGreen, Icons.Filled.CheckCircle),
    Pending(SosIosColors.AccentBlueText, Icons.Filled.Schedule),
    Warning(SosIosColors.WarningOrange, Icons.Filled.Warning),
    Error(Color(0xFFFF6B60), Icons.Filled.Error),
    Neutral(SosIosColors.LabelSecondary, Icons.Filled.Schedule),
}

/** iOS StatusBadge: tinted capsule with icon + short label (used as status chip). */
@Composable
fun SosBadge(
    kind: SosBadgeKind,
    text: String,
    modifier: Modifier = Modifier,
    icon: ImageVector = kind.icon,
) {
    Row(
        modifier =
            modifier
                .clip(CircleShape)
                .background(kind.color.copy(alpha = 0.16f))
                .padding(horizontal = SosSpacing.sm, vertical = SosSpacing.xxs + 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(SosSpacing.xxs + 2.dp),
    ) {
        Icon(imageVector = icon, contentDescription = null, tint = kind.color, modifier = Modifier.size(14.dp))
        Text(
            text = text,
            style = MaterialTheme.typography.labelSmall,
            color = kind.color,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

/** iOS PrimaryButton: filled accent blue (or emergency red when [destructive]). */
@Composable
fun SosPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    destructive: Boolean = false,
    enabled: Boolean = true,
    testTag: String? = null,
) {
    val container = if (destructive) SosIosColors.EmergencyRed else SosIosColors.AccentBlue
    Button(
        onClick = onClick,
        enabled = enabled,
        shape = SosShapes.button,
        contentPadding = PaddingValues(horizontal = SosSpacing.md, vertical = SosSpacing.sm),
        colors =
            ButtonDefaults.buttonColors(
                containerColor = container,
                contentColor = Color.White,
                disabledContainerColor = container.copy(alpha = 0.35f),
                disabledContentColor = Color.White.copy(alpha = 0.6f),
            ),
        modifier =
            modifier
                .fillMaxWidth()
                .defaultMinSize(minHeight = SosSpacing.touchMin)
                .then(if (testTag != null) Modifier.testTag(testTag) else Modifier)
                .semantics {
                    contentDescription = text
                    role = Role.Button
                },
    ) {
        SosButtonLabel(text = text, icon = icon)
    }
}

/** iOS SecondaryButton: 2dp accent-blue outline. */
@Composable
fun SosSecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    enabled: Boolean = true,
    testTag: String? = null,
) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        shape = SosShapes.button,
        border = BorderStroke(2.dp, SosIosColors.AccentBlue.copy(alpha = if (enabled) 1f else 0.35f)),
        contentPadding = PaddingValues(horizontal = SosSpacing.md, vertical = SosSpacing.sm),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = SosIosColors.AccentBlueText),
        modifier =
            modifier
                .fillMaxWidth()
                .defaultMinSize(minHeight = SosSpacing.touchMin)
                .then(if (testTag != null) Modifier.testTag(testTag) else Modifier)
                .semantics {
                    contentDescription = text
                    role = Role.Button
                },
    ) {
        SosButtonLabel(text = text, icon = icon)
    }
}

@Composable
private fun SosButtonLabel(
    text: String,
    icon: ImageVector?,
) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(SosSpacing.xs)) {
        if (icon != null) {
            Icon(imageVector = icon, contentDescription = null, modifier = Modifier.size(20.dp))
        }
        Text(text = text, style = MaterialTheme.typography.titleMedium)
    }
}

/** Uppercase-free section caption used above grouped cards (profile / settings sections). */
@Composable
fun SosSectionHeader(
    text: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = text,
        style = MaterialTheme.typography.titleSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = modifier.padding(start = SosSpacing.xs, top = SosSpacing.xs),
    )
}

/** Label on the left, value on the right (iOS diagnosticRow). */
@Composable
fun SosKeyValueRow(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    valueColor: Color = MaterialTheme.colorScheme.onSurface,
) {
    Row(
        modifier = modifier.fillMaxWidth().padding(vertical = SosSpacing.xxs),
        horizontalArrangement = Arrangement.spacedBy(SosSpacing.sm),
        verticalAlignment = Alignment.Top,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f),
        )
        Text(text = value, style = MaterialTheme.typography.bodyMedium, color = valueColor, fontWeight = FontWeight.Medium)
    }
}

/** Title + description with a trailing switch (iOS toggle card). */
@Composable
fun SosToggleRow(
    title: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    description: String? = null,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(SosSpacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(SosSpacing.xxs)) {
            Text(text = title, style = MaterialTheme.typography.titleMedium)
            if (description != null) {
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            modifier =
                Modifier.semantics {
                    contentDescription = title
                    role = Role.Switch
                },
            colors =
                SwitchDefaults.colors(
                    checkedTrackColor = SosIosColors.SuccessGreen,
                    checkedThumbColor = Color.White,
                ),
        )
    }
}

/** Card row: leading tinted icon + text column (iOS gate step / info rows). */
@Composable
fun SosIconCard(
    icon: ImageVector,
    modifier: Modifier = Modifier,
    iconTint: Color = SosIosColors.AccentBlueText,
    highlighted: Boolean = false,
    accent: Color = SosIosColors.AccentBlue,
    content: @Composable ColumnScope.() -> Unit,
) {
    SosCard(modifier = modifier, highlighted = highlighted, accent = accent) {
        Row(horizontalArrangement = Arrangement.spacedBy(SosSpacing.sm), verticalAlignment = Alignment.Top) {
            Icon(imageVector = icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(24.dp))
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(SosSpacing.xxs), content = content)
        }
    }
}

/** Timeline row (iOS timelineStep): 24dp circle with check, label, trailing check when reached. */
@Composable
fun SosTimelineRow(
    label: String,
    reached: Boolean,
    modifier: Modifier = Modifier,
) {
    val state = stringResource(if (reached) R.string.design_step_done else R.string.design_step_pending)
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(vertical = SosSpacing.xxs)
                .semantics(mergeDescendants = true) { stateDescription = state },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(SosSpacing.xs),
    ) {
        Box(
            modifier =
                Modifier
                    .size(24.dp)
                    .clip(CircleShape)
                    .background(if (reached) SosIosColors.SuccessGreen else SosIosColors.LabelTertiary.copy(alpha = 0.3f)),
            contentAlignment = Alignment.Center,
        ) {
            if (reached) {
                Icon(imageVector = Icons.Filled.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(14.dp))
            } else {
                Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(SosIosColors.LabelTertiary))
            }
        }
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = if (reached) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f),
        )
        if (reached) {
            Icon(imageVector = Icons.Filled.CheckCircle, contentDescription = null, tint = SosIosColors.SuccessGreen)
        }
    }
}

/** Hairline-bordered icon tile used for the header glyph on Relay / Status. */
@Composable
fun SosHeaderGlyph(
    icon: ImageVector,
    modifier: Modifier = Modifier,
    tint: Color = SosIosColors.AccentBlueText,
) {
    Box(modifier = modifier.border(1.dp, SosIosColors.Separator, CircleShape).padding(SosSpacing.md)) {
        Icon(imageVector = icon, contentDescription = null, tint = tint, modifier = Modifier.size(32.dp))
    }
}

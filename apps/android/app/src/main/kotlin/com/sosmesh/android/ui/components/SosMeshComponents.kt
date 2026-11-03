package com.sosmesh.android.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalInspectionMode
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.sosmesh.android.R
import com.sosmesh.android.ui.theme.SosSpacing

@Composable
fun SosMeshLogo(
    modifier: Modifier = Modifier,
    size: Int = 72,
) {
    val isPreview = LocalInspectionMode.current
    if (!isPreview) {
        Image(
            painter = painterResource(id = R.drawable.ic_sosmesh_logo),
            contentDescription = "SOSMesh Logo",
            modifier = modifier.size(size.dp),
        )
    }
}

@Composable
fun SosMeshCard(
    modifier: Modifier = Modifier,
    title: String? = null,
    icon: Any? = null,
    contentDescription: String? = null,
    content: @Composable () -> Unit,
) {
    val scale = remember { Animatable(0.95f) }
    LaunchedEffect(Unit) {
        scale.animateTo(
            targetValue = 1f,
            animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow),
        )
    }

    Card(
        modifier =
            modifier
                .fillMaxWidth()
                .graphicsLayer {
                    scaleX = scale.value
                    scaleY = scale.value
                }
                .then(
                    if (contentDescription != null) {
                        Modifier.semantics { this.contentDescription = contentDescription }
                    } else {
                        Modifier
                    },
                ),
        colors =
            CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surface,
            ),
        elevation =
            CardDefaults.cardElevation(
                defaultElevation = 2.dp,
            ),
    ) {
        Column(
            modifier = Modifier.padding(SosSpacing.md),
            verticalArrangement = Arrangement.spacedBy(SosSpacing.sm),
        ) {
            if (title != null || icon != null) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(SosSpacing.sm),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    when (icon) {
                        is ImageVector ->
                            Icon(
                                imageVector = icon,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                            )
                        is Painter ->
                            Icon(
                                painter = icon,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                            )
                    }
                    if (title != null) {
                        Text(
                            text = title,
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                    }
                }
            }
            content()
        }
    }
}

@Composable
fun SosMeshBadge(
    text: String,
    modifier: Modifier = Modifier,
    type: BadgeType = BadgeType.INFO,
) {
    val containerColor =
        when (type) {
            BadgeType.ERROR -> MaterialTheme.colorScheme.errorContainer
            BadgeType.WARNING -> MaterialTheme.colorScheme.tertiaryContainer
            BadgeType.SUCCESS -> MaterialTheme.colorScheme.primaryContainer
            BadgeType.INFO -> MaterialTheme.colorScheme.surfaceVariant
        }
    val contentColor =
        when (type) {
            BadgeType.ERROR -> MaterialTheme.colorScheme.onErrorContainer
            BadgeType.WARNING -> MaterialTheme.colorScheme.onTertiaryContainer
            BadgeType.SUCCESS -> MaterialTheme.colorScheme.onPrimaryContainer
            BadgeType.INFO -> MaterialTheme.colorScheme.onSurfaceVariant
        }

    Surface(
        color = containerColor,
        shape = MaterialTheme.shapes.small,
        modifier = modifier,
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            style = MaterialTheme.typography.labelLarge,
            color = contentColor,
        )
    }
}

enum class BadgeType {
    ERROR,
    WARNING,
    SUCCESS,
    INFO,
}

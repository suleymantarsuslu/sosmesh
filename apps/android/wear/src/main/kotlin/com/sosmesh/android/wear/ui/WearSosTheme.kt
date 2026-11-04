package com.sosmesh.android.wear.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.wear.compose.material.Colors
import androidx.wear.compose.material.MaterialTheme

/** Wear palette: near-black background, emergency red primary. Always dark. */
internal object WearSosPalette {
    val Background = Color(0xFF05070C)
    val Surface = Color(0xFF131A29)
    val SurfaceHigh = Color(0xFF1C2538)
    val EmergencyRed = Color(0xFFE63326)
    val EmergencyRedDeep = Color(0xFF8E1A12)
    val OnEmergencyRed = Color(0xFFFFFFFF)
    val Success = Color(0xFF3DBE5A)
    val Warning = Color(0xFFFFB300)
    val Error = Color(0xFFFF7A6E)
    val TextPrimary = Color(0xFFE8ECF4)
    val TextMuted = Color(0xFFA9B4C6)
    val Outline = Color(0xFF3A465C)
}

private val WearSosColors =
    Colors(
        primary = WearSosPalette.EmergencyRed,
        primaryVariant = WearSosPalette.EmergencyRedDeep,
        secondary = WearSosPalette.Warning,
        secondaryVariant = WearSosPalette.Warning,
        background = WearSosPalette.Background,
        surface = WearSosPalette.Surface,
        error = WearSosPalette.Error,
        onPrimary = WearSosPalette.OnEmergencyRed,
        onSecondary = Color(0xFF1A1200),
        onBackground = WearSosPalette.TextPrimary,
        onSurface = WearSosPalette.TextPrimary,
        onSurfaceVariant = WearSosPalette.TextMuted,
        onError = Color(0xFF1A0504),
    )

@Composable
internal fun WearSosTheme(content: @Composable () -> Unit) {
    MaterialTheme(colors = WearSosColors, content = content)
}

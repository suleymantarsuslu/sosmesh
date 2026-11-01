package com.sosmesh.android.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val SosRed = Color(0xFFB00020)
private val OnSosRed = Color(0xFFFFFFFF)
private val LightBackground = Color(0xFFF5F5F5)
private val LightOnBackground = Color(0xFF1A1A1A)
private val DarkBackground = Color(0xFF121212)
private val DarkOnBackground = Color(0xFFF0F0F0)

private val LightColors =
    lightColorScheme(
        primary = SosRed,
        onPrimary = OnSosRed,
        background = LightBackground,
        onBackground = LightOnBackground,
        error = SosRed,
    )

private val DarkColors =
    darkColorScheme(
        primary = SosRed,
        onPrimary = OnSosRed,
        background = DarkBackground,
        onBackground = DarkOnBackground,
        error = SosRed,
    )

object SosContrastPairs {
    val lightTextOnBackground = LightOnBackground to LightBackground
    val lightTextOnPrimary = OnSosRed to SosRed
    val darkTextOnBackground = DarkOnBackground to DarkBackground
    val darkTextOnPrimary = OnSosRed to SosRed
}

@Composable
fun SosMeshTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content,
    )
}

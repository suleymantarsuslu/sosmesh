package com.sosmesh.android.core.design.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors =
    lightColorScheme(
        primary = SosBrandColors.SosRed,
        onPrimary = SosBrandColors.OnSosRed,
        primaryContainer = Color(0xFFFFDAD6),
        onPrimaryContainer = Color(0xFF410002),
        secondary = Color(0xFF455A64),
        onSecondary = Color(0xFFFFFFFF),
        secondaryContainer = Color(0xFFCFD8DC),
        onSecondaryContainer = Color(0xFF101820),
        tertiary = SosBrandColors.AccentAmber,
        onTertiary = Color(0xFF1A1200),
        background = SosBrandColors.LightBackground,
        onBackground = SosBrandColors.LightOnBackground,
        surface = SosBrandColors.LightSurface,
        onSurface = SosBrandColors.LightOnBackground,
        surfaceVariant = Color(0xFFE2E8F0),
        onSurfaceVariant = Color(0xFF334155),
        error = SosBrandColors.SosRedBright,
        onError = SosBrandColors.OnSosRed,
        errorContainer = Color(0xFFFFDAD6),
        onErrorContainer = Color(0xFF410002),
        outline = SosBrandColors.OutlineLight,
    )

private val DarkColors =
    darkColorScheme(
        primary = SosBrandColors.SosRedBright,
        onPrimary = SosBrandColors.OnSosRed,
        primaryContainer = Color(0xFF93000A),
        onPrimaryContainer = Color(0xFFFFDAD6),
        secondary = Color(0xFF90A4AE),
        onSecondary = Color(0xFF1A252C),
        secondaryContainer = Color(0xFF37474F),
        onSecondaryContainer = Color(0xFFCFD8DC),
        tertiary = SosBrandColors.AccentAmber,
        onTertiary = Color(0xFF261A00),
        background = SosBrandColors.DarkBackground,
        onBackground = SosBrandColors.DarkOnBackground,
        surface = SosBrandColors.DarkSurface,
        onSurface = SosBrandColors.DarkOnBackground,
        surfaceVariant = SosBrandColors.NavyMuted,
        onSurfaceVariant = Color(0xFFCBD5E1),
        error = Color(0xFFFFB4AB),
        onError = Color(0xFF690005),
        errorContainer = Color(0xFF93000A),
        onErrorContainer = Color(0xFFFFDAD6),
        outline = SosBrandColors.OutlineDark,
    )

private val HighContrastLightColors =
    lightColorScheme(
        primary = Color(0xFF000000),
        onPrimary = Color(0xFFFFFFFF),
        background = Color(0xFFFFFFFF),
        onBackground = Color(0xFF000000),
        surface = Color(0xFFFFFFFF),
        onSurface = Color(0xFF000000),
        error = SosBrandColors.SosRed,
        onError = Color(0xFFFFFFFF),
    )

private val HighContrastDarkColors =
    darkColorScheme(
        primary = Color(0xFFFFFFFF),
        onPrimary = Color(0xFF000000),
        background = Color(0xFF000000),
        onBackground = Color(0xFFFFFFFF),
        surface = Color(0xFF000000),
        onSurface = Color(0xFFFFFFFF),
        error = Color(0xFFFF6B6B),
        onError = Color(0xFF000000),
    )

object SosContrastPairs {
    val lightTextOnBackground = SosBrandColors.LightOnBackground to SosBrandColors.LightBackground
    val lightTextOnPrimary = SosBrandColors.OnSosRed to SosBrandColors.SosRed
    val darkTextOnBackground = SosBrandColors.DarkOnBackground to SosBrandColors.DarkBackground
    val darkTextOnPrimary = SosBrandColors.OnSosRed to SosBrandColors.SosRedBright
}

@Composable
fun SosMeshTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    highContrast: Boolean = false,
    content: @Composable () -> Unit,
) {
    val colors =
        when {
            highContrast && darkTheme -> HighContrastDarkColors
            highContrast -> HighContrastLightColors
            darkTheme -> DarkColors
            else -> LightColors
        }
    MaterialTheme(
        colorScheme = colors,
        typography = SosMeshTypography,
        shapes =
            androidx.compose.material3.Shapes(
                extraSmall = SosShapes.chip,
                small = SosShapes.banner,
                medium = SosShapes.card,
                large = SosShapes.button,
                extraLarge = SosShapes.button,
            ),
        content = content,
    )
}

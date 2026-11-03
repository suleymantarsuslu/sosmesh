package com.sosmesh.android.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.shape.RoundedCornerShape

private val MeshNavy = Color(0xFF1A2844)
private val MeshCyan = Color(0xFF38BDF8)
private val MeshCyanLight = Color(0xFF7DD3FC)
private val SosRed = Color(0xFFDC2626)
private val SosRedLight = Color(0xFFEF4444)
private val OnSosRed = Color(0xFFFFFFFF)

private val LightBackground = Color(0xFFF8FAFC)
private val LightSurface = Color(0xFFFFFFFF)
private val LightOnBackground = Color(0xFF0F172A)
private val LightSurfaceVariant = Color(0xFFF1F5F9)

private val DarkBackground = Color(0xFF0F172A)
private val DarkSurface = Color(0xFF1E293B)
private val DarkOnBackground = Color(0xFFF1F5F9)
private val DarkSurfaceVariant = Color(0xFF334155)

private val HighContrastLightBackground = Color(0xFFFFFFFF)
private val HighContrastLightOnBackground = Color(0xFF000000)
private val HighContrastDarkBackground = Color(0xFF000000)
private val HighContrastDarkOnBackground = Color(0xFFFFFFFF)

private val LightColors =
    lightColorScheme(
        primary = MeshCyan,
        onPrimary = MeshNavy,
        primaryContainer = MeshCyanLight,
        onPrimaryContainer = MeshNavy,
        secondary = MeshNavy,
        onSecondary = Color(0xFFFFFFFF),
        secondaryContainer = Color(0xFF334155),
        onSecondaryContainer = Color(0xFFE2E8F0),
        tertiary = SosRed,
        onTertiary = OnSosRed,
        tertiaryContainer = Color(0xFFFEE2E2),
        onTertiaryContainer = Color(0xFF7F1D1D),
        background = LightBackground,
        onBackground = LightOnBackground,
        surface = LightSurface,
        onSurface = LightOnBackground,
        surfaceVariant = LightSurfaceVariant,
        onSurfaceVariant = Color(0xFF475569),
        error = SosRed,
        onError = OnSosRed,
        errorContainer = Color(0xFFFEE2E2),
        onErrorContainer = Color(0xFF7F1D1D),
        outline = Color(0xFFCBD5E1),
        outlineVariant = Color(0xFFE2E8F0),
    )

private val DarkColors =
    darkColorScheme(
        primary = MeshCyanLight,
        onPrimary = MeshNavy,
        primaryContainer = MeshNavy,
        onPrimaryContainer = MeshCyanLight,
        secondary = Color(0xFF94A3B8),
        onSecondary = DarkBackground,
        secondaryContainer = Color(0xFF334155),
        onSecondaryContainer = Color(0xFFE2E8F0),
        tertiary = SosRedLight,
        onTertiary = OnSosRed,
        tertiaryContainer = Color(0xFF7F1D1D),
        onTertiaryContainer = Color(0xFFFECDD3),
        background = DarkBackground,
        onBackground = DarkOnBackground,
        surface = DarkSurface,
        onSurface = DarkOnBackground,
        surfaceVariant = DarkSurfaceVariant,
        onSurfaceVariant = Color(0xFF94A3B8),
        error = SosRedLight,
        onError = Color(0xFF000000),
        errorContainer = Color(0xFF7F1D1D),
        onErrorContainer = Color(0xFFFECDD3),
        outline = Color(0xFF475569),
        outlineVariant = Color(0xFF334155),
    )

private val HighContrastLightColors =
    lightColorScheme(
        primary = Color(0xFF000000),
        onPrimary = Color(0xFFFFFFFF),
        background = HighContrastLightBackground,
        onBackground = HighContrastLightOnBackground,
        error = SosRed,
    )

private val HighContrastDarkColors =
    darkColorScheme(
        primary = Color(0xFFFFFFFF),
        onPrimary = Color(0xFF000000),
        background = HighContrastDarkBackground,
        onBackground = HighContrastDarkOnBackground,
        error = SosRedLight,
    )

private val SosMeshTypography =
    Typography(
        displayLarge =
            TextStyle(
                fontWeight = FontWeight.Bold,
                fontSize = 57.sp,
                lineHeight = 64.sp,
                letterSpacing = (-0.25).sp,
            ),
        displayMedium =
            TextStyle(
                fontWeight = FontWeight.Bold,
                fontSize = 45.sp,
                lineHeight = 52.sp,
            ),
        displaySmall =
            TextStyle(
                fontWeight = FontWeight.Bold,
                fontSize = 36.sp,
                lineHeight = 44.sp,
            ),
        headlineLarge =
            TextStyle(
                fontWeight = FontWeight.Bold,
                fontSize = 32.sp,
                lineHeight = 40.sp,
            ),
        headlineMedium =
            TextStyle(
                fontWeight = FontWeight.SemiBold,
                fontSize = 28.sp,
                lineHeight = 36.sp,
            ),
        headlineSmall =
            TextStyle(
                fontWeight = FontWeight.SemiBold,
                fontSize = 24.sp,
                lineHeight = 32.sp,
            ),
        titleLarge =
            TextStyle(
                fontWeight = FontWeight.SemiBold,
                fontSize = 22.sp,
                lineHeight = 28.sp,
            ),
        titleMedium =
            TextStyle(
                fontWeight = FontWeight.Medium,
                fontSize = 16.sp,
                lineHeight = 24.sp,
                letterSpacing = 0.15.sp,
            ),
        titleSmall =
            TextStyle(
                fontWeight = FontWeight.Medium,
                fontSize = 14.sp,
                lineHeight = 20.sp,
                letterSpacing = 0.1.sp,
            ),
        bodyLarge =
            TextStyle(
                fontWeight = FontWeight.Normal,
                fontSize = 16.sp,
                lineHeight = 24.sp,
                letterSpacing = 0.5.sp,
            ),
        bodyMedium =
            TextStyle(
                fontWeight = FontWeight.Normal,
                fontSize = 14.sp,
                lineHeight = 20.sp,
                letterSpacing = 0.25.sp,
            ),
        bodySmall =
            TextStyle(
                fontWeight = FontWeight.Normal,
                fontSize = 12.sp,
                lineHeight = 16.sp,
                letterSpacing = 0.4.sp,
            ),
        labelLarge =
            TextStyle(
                fontWeight = FontWeight.Medium,
                fontSize = 14.sp,
                lineHeight = 20.sp,
                letterSpacing = 0.1.sp,
            ),
        labelMedium =
            TextStyle(
                fontWeight = FontWeight.Medium,
                fontSize = 12.sp,
                lineHeight = 16.sp,
                letterSpacing = 0.5.sp,
            ),
        labelSmall =
            TextStyle(
                fontWeight = FontWeight.Medium,
                fontSize = 11.sp,
                lineHeight = 16.sp,
                letterSpacing = 0.5.sp,
            ),
    )

private val SosMeshShapes =
    Shapes(
        extraSmall = RoundedCornerShape(4.dp),
        small = RoundedCornerShape(8.dp),
        medium = RoundedCornerShape(12.dp),
        large = RoundedCornerShape(16.dp),
        extraLarge = RoundedCornerShape(24.dp),
    )

object SosContrastPairs {
    val lightTextOnBackground = LightOnBackground to LightBackground
    val lightTextOnPrimary = MeshNavy to MeshCyan
    val darkTextOnBackground = DarkOnBackground to DarkBackground
    val darkTextOnPrimary = MeshNavy to MeshCyanLight
}

object SosSpacing {
    val xs = 4.dp
    val sm = 8.dp
    val md = 16.dp
    val lg = 24.dp
    val xl = 32.dp
    val xxl = 48.dp
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
        shapes = SosMeshShapes,
        content = content,
    )
}

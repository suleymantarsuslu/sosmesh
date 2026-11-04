package com.sosmesh.android.core.design.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * Fixed brand palette sampled from [branding/sosmesh-logo-source.png] and launcher metadata.
 * Not dynamic Material You — colors stay consistent with SOSMesh branding.
 */
object SosBrandColors {
    val Navy = Color(0xFF070D1D)
    val NavyElevated = Color(0xFF0E1628)
    val NavyMuted = Color(0xFF1A2438)
    val SosRed = Color(0xFFC62828)
    val SosRedBright = Color(0xFFD32F2F)
    val OnSosRed = Color(0xFFFFFFFF)
    val AccentAmber = Color(0xFFFFB300)
    val LightBackground = Color(0xFFF4F6FA)
    val LightSurface = Color(0xFFFFFFFF)
    val LightOnBackground = Color(0xFF0B1220)
    val DarkBackground = Navy
    val DarkSurface = NavyElevated
    val DarkOnBackground = Color(0xFFE8ECF4)
    val OutlineLight = Color(0xFFCBD5E1)
    val OutlineDark = Color(0xFF475569)
}

/**
 * Palette mirrored from the iOS DesignSystem (apps/ios/SOSMesh/DesignSystem/DesignSystem.swift) in its
 * dark appearance. iOS screens sit on secondarySystemBackground (#1C1C1E) and cards on systemBackground
 * (#000000). Emergency red is the iOS value (#E63326) deepened slightly so white text on it passes WCAG AA.
 */
object SosIosColors {
    val EmergencyRed = Color(0xFFDB2C20)
    val AccentBlue = Color(0xFF1A66CC)
    val AccentBlueText = Color(0xFF6FA8FF)
    val SuccessGreen = Color(0xFF33B34D)
    val WarningOrange = Color(0xFFFF9900)
    val ScreenBackground = Color(0xFF1C1C1E)
    val CardBackground = Color(0xFF000000)
    val CardBackgroundRaised = Color(0xFF2C2C2E)
    val Separator = Color(0xFF38383A)
    val LabelPrimary = Color(0xFFFFFFFF)
    val LabelSecondary = Color(0xFFA1A1A6)
    val LabelTertiary = Color(0xFF8E8E93)
}

object SosSpacing {
    val xxs = 4.dp
    val xs = 8.dp
    val sm = 12.dp
    val md = 16.dp
    val lg = 24.dp
    val xl = 32.dp
    val touchMin = 48.dp
    val sosButtonHeight = 80.dp
}

object SosShapes {
    /** iOS CornerRadius.md (cards, buttons). */
    val card = RoundedCornerShape(12.dp)
    val button = RoundedCornerShape(12.dp)
    val banner = RoundedCornerShape(12.dp)
    val chip = RoundedCornerShape(8.dp)

    /** iOS CornerRadius.lg (large SOS button). */
    val sosButton = RoundedCornerShape(16.dp)
}

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
    val card = RoundedCornerShape(16.dp)
    val button = RoundedCornerShape(20.dp)
    val banner = RoundedCornerShape(12.dp)
    val chip = RoundedCornerShape(8.dp)
}

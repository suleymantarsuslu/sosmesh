package com.sosmesh.android.core.design.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

private fun ios(
    size: Int,
    weight: FontWeight,
    lineHeight: Int,
) = TextStyle(
    fontFamily = FontFamily.SansSerif,
    fontWeight = weight,
    fontSize = size.sp,
    lineHeight = lineHeight.sp,
)

/**
 * Type scale mirrored from the iOS DesignSystem.Typography (largeTitle 34 / title1 28 / title2 22 /
 * title3 20 / headline 17 / body 17 / callout 16 / subheadline 15 / footnote 13 / caption 12 / 11).
 */
val SosMeshTypography =
    Typography(
        displayLarge = ios(34, FontWeight.Bold, 40),
        displayMedium = ios(34, FontWeight.Bold, 40),
        displaySmall = ios(28, FontWeight.Bold, 34),
        headlineLarge = ios(28, FontWeight.Bold, 34),
        headlineMedium = ios(22, FontWeight.Bold, 28),
        headlineSmall = ios(20, FontWeight.SemiBold, 26),
        titleLarge = ios(20, FontWeight.SemiBold, 26),
        titleMedium = ios(17, FontWeight.SemiBold, 22),
        titleSmall = ios(15, FontWeight.SemiBold, 20),
        bodyLarge = ios(17, FontWeight.Normal, 24),
        bodyMedium = ios(16, FontWeight.Normal, 22),
        bodySmall = ios(13, FontWeight.Normal, 18),
        labelLarge = ios(16, FontWeight.Medium, 20),
        labelMedium = ios(13, FontWeight.Medium, 18),
        labelSmall = ios(12, FontWeight.Medium, 16),
    )

package com.sosmesh.android.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable

typealias SosContrastPairs = com.sosmesh.android.core.design.theme.SosContrastPairs

@Composable
fun SosMeshTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    highContrast: Boolean = false,
    content: @Composable () -> Unit,
) {
    com.sosmesh.android.core.design.theme.SosMeshTheme(
        darkTheme = darkTheme,
        highContrast = highContrast,
        content = content,
    )
}

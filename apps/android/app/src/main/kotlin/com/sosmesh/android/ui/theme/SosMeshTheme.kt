package com.sosmesh.android.ui.theme

import androidx.compose.runtime.Composable

typealias SosContrastPairs = com.sosmesh.android.core.design.theme.SosContrastPairs

/** The app is dark by default and does not follow the system light/dark setting. */
@Composable
fun SosMeshTheme(
    highContrast: Boolean = false,
    content: @Composable () -> Unit,
) {
    com.sosmesh.android.core.design.theme.SosMeshTheme(
        darkTheme = true,
        highContrast = highContrast,
        content = content,
    )
}

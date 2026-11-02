package com.sosmesh.android.wear.ui

import androidx.compose.ui.graphics.Color

/**
 * Burn-in safe palette when the watch enters ambient / always-on display.
 * Full-color SOS is shown only in interactive mode.
 */
object WearAmbientUiPolicy {
    fun sosBackground(isAmbient: Boolean): Color =
        if (isAmbient) {
            Color(0xFF424242)
        } else {
            Color(0xFFB71C1C)
        }

    fun primaryText(isAmbient: Boolean): Color =
        if (isAmbient) {
            Color(0xFFE0E0E0)
        } else {
            Color.White
        }

    fun hideSecondaryDetailInAmbient(isAmbient: Boolean): Boolean = isAmbient
}

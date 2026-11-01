package com.sosmesh.android.ui.theme

import org.junit.Assert.assertTrue
import org.junit.Test

class SosContrastRatioTest {
    @Test
    fun lightThemeTextPairs_meetWcagAa() {
        assertTrue(ratio(SosContrastPairs.lightTextOnBackground) >= 4.5)
        assertTrue(ratio(SosContrastPairs.lightTextOnPrimary) >= 4.5)
    }

    @Test
    fun darkThemeTextPairs_meetWcagAa() {
        assertTrue(ratio(SosContrastPairs.darkTextOnBackground) >= 4.5)
        assertTrue(ratio(SosContrastPairs.darkTextOnPrimary) >= 4.5)
    }

    private fun ratio(pair: Pair<androidx.compose.ui.graphics.Color, androidx.compose.ui.graphics.Color>): Double {
        val fg = pair.first
        val bg = pair.second
        return contrast(luminance(fg), luminance(bg))
    }

    private fun luminance(color: androidx.compose.ui.graphics.Color): Double {
        fun channel(c: Float): Double {
            val v = c.toDouble()
            return if (v <= 0.03928) {
                v / 12.92
            } else {
                Math.pow((v + 0.055) / 1.055, 2.4)
            }
        }
        val r = channel(color.red)
        val g = channel(color.green)
        val b = channel(color.blue)
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }

    private fun contrast(
        l1: Double,
        l2: Double,
    ): Double {
        val lighter = maxOf(l1, l2)
        val darker = minOf(l1, l2)
        return (lighter + 0.05) / (darker + 0.05)
    }
}

package com.sosmesh.android.wear.ui

import android.content.Context
import android.view.accessibility.AccessibilityManager
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.changedToDown
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext

/** Time after the confirmation screen appears during which Send ignores input. */
internal const val SEND_ARM_DELAY_MILLIS = 600L

/**
 * Guards the irreversible Send action on the confirmation screen.
 *
 * Send is accepted only when the screen has been visible for [SEND_ARM_DELAY_MILLIS] and the
 * tap's own pointer-down arrived after that moment. A pointer that was already down when the
 * screen appeared (for example the tail of the hold gesture) never produces a valid press.
 */
internal class WearSendGate {
    var armed: Boolean = false
    var validDown: Boolean = false

    /** Returns true at most once per fresh press. Touch-exploration (TalkBack) clicks have no pointer. */
    fun consume(touchExploration: Boolean): Boolean {
        val accepted = armed && (validDown || touchExploration)
        validDown = false
        return accepted
    }
}

internal fun Modifier.freshPressGate(gate: WearSendGate): Modifier =
    pointerInput(gate) {
        awaitPointerEventScope {
            while (true) {
                val event = awaitPointerEvent(PointerEventPass.Initial)
                if (event.changes.any { it.changedToDown() }) {
                    gate.validDown = gate.armed
                }
            }
        }
    }

@Composable
internal fun isTouchExplorationEnabled(): Boolean {
    val manager = LocalContext.current.getSystemService(Context.ACCESSIBILITY_SERVICE) as? AccessibilityManager
    return manager?.isTouchExplorationEnabled == true
}

package com.sosmesh.android.wear.ui

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [30], qualifiers = "w450dp-h450dp-round")
class WearConfirmSendGateTest {
    @get:Rule
    val composeRule = createAndroidComposeRule<ComponentActivity>()

    private var sends = 0

    private fun show() {
        composeRule.mainClock.autoAdvance = false
        composeRule.setContent {
            WearSosTheme {
                WearConfirmScreen(onSend = { sends++ }, onCancel = {})
            }
        }
    }

    private fun tapSend() {
        composeRule.onNodeWithTag("wear_confirm_send").performTouchInput {
            down(center)
            up()
        }
    }

    @Test
    fun tapRightAfterScreenAppears_isIgnored() {
        show()
        tapSend()
        composeRule.onNodeWithTag("wear_confirm_send").performClick()
        assertEquals(0, sends)
    }

    @Test
    fun pointerDownBeforeArmed_thenUpAfterArmed_isIgnored() {
        show()
        composeRule.onNodeWithTag("wear_confirm_send").performTouchInput { down(center) }
        composeRule.mainClock.advanceTimeBy(SEND_ARM_DELAY_MILLIS + 100)
        composeRule.onNodeWithTag("wear_confirm_send").performTouchInput { up() }
        assertEquals(0, sends)
    }

    @Test
    fun freshTapAfterArmDelay_sends_exactlyOnce() {
        show()
        composeRule.mainClock.advanceTimeBy(SEND_ARM_DELAY_MILLIS + 100)
        tapSend()
        assertEquals(1, sends)
    }
}

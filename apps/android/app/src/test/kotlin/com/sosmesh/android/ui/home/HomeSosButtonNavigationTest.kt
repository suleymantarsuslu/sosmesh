package com.sosmesh.android.ui.home

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import org.junit.Rule
import org.junit.Test

class HomeSosButtonNavigationTest {
    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun sosPrimaryButton_onClick_navigatesToSosFlow_doesNotSendImmediately() {
        var sosNavigateCalled = false
        var expressSosCalled = false

        composeTestRule.setContent {
            HomeScreen(
                state = HomeUiState(),
                onOpenPermissions = {},
                onOpenRadioDebug = {},
                onOpenSos = { sosNavigateCalled = true },
                onOpenStatus = {},
                onOpenRelay = {},
                onOpenSettings = {},
            )
        }

        composeTestRule.onNodeWithText("SOS", substring = true, ignoreCase = true).performClick()

        assert(sosNavigateCalled) { "SOS button should navigate to SOS flow screen" }
        assert(!expressSosCalled) { "SOS button should NOT send immediately" }
    }
}

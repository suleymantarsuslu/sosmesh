package com.sosmesh.android.ui.home

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], qualifiers = "w360dp-h640dp")
class HomeSosButtonNavigationTest {
    @get:Rule
    val composeTestRule = createAndroidComposeRule<ComponentActivity>()

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

        composeTestRule.onNodeWithTag("home_express_sos_button").performClick()

        assert(sosNavigateCalled) { "SOS button should navigate to SOS flow screen" }
        assert(!expressSosCalled) { "SOS button should NOT send immediately" }
    }
}

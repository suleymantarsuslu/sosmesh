package com.sosmesh.android.ui.home

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], qualifiers = "w360dp-h640dp")
class HomeScreenRobolectricTest {
    @get:Rule
    val composeRule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun call112Button_isVisibleOnHomeScreen() {
        composeRule.setContent {
            HomeScreen(
                state = HomeUiState(),
                onOpenPermissions = {},
                onOpenRadioDebug = {},
                onOpenSos = {},
                onOpenStatus = {},
                onOpenRelay = {},
                onOpenSettings = {},
            )
        }
        composeRule.onNodeWithTag("home_call_112_button").assertIsDisplayed()
    }
}

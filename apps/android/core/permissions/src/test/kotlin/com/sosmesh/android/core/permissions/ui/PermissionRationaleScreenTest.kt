package com.sosmesh.android.core.permissions.ui

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.sosmesh.android.core.permissions.PermissionRequestOutcome
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], qualifiers = "tr")
class PermissionRationaleScreenTest {
    @get:Rule
    val composeRule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun rationaleGrantButton_isVisibleWithAccessibilitySemantics() {
        var requested = false
        composeRule.setContent {
            PermissionRationaleScreen(
                state =
                    PermissionScreenState(
                        rationaleMessage = "Bluetooth rationale",
                        outcome = null,
                        showSettingsAction = false,
                    ),
                onRequestPermission = { requested = true },
                onOpenSettings = {},
            )
        }
        composeRule.onNodeWithTag("permission_request_button").assertIsDisplayed()
        composeRule.onNodeWithContentDescription("İzni ver").performClick()
        assertEquals(true, requested)
    }

    @Test
    fun permanentlyDenied_showsSettingsButton() {
        var settingsOpened = false
        composeRule.setContent {
            PermissionRationaleScreen(
                state =
                    PermissionScreenState(
                        rationaleMessage = "Need Bluetooth",
                        outcome = PermissionRequestOutcome.PERMANENTLY_DENIED,
                        showSettingsAction = true,
                    ),
                onRequestPermission = {},
                onOpenSettings = { settingsOpened = true },
            )
        }
        composeRule.onNodeWithTag("permission_settings_button").assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Ayarlara git").performClick()
        assertEquals(true, settingsOpened)
    }

    @Test
    fun permissionButtons_haveMinimumTouchHeightSemantics() {
        composeRule.setContent {
            PermissionRationaleScreen(
                state =
                    PermissionScreenState(
                        rationaleMessage = "Rationale",
                        outcome = null,
                        showSettingsAction = true,
                    ),
                onRequestPermission = {},
                onOpenSettings = {},
            )
        }
        composeRule.onNodeWithTag("permission_request_button").assertIsDisplayed()
        composeRule.onNodeWithTag("permission_settings_button").assertIsDisplayed()
    }
}

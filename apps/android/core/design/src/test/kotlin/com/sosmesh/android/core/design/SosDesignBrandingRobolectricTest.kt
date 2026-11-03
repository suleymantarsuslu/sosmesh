package com.sosmesh.android.core.design

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import com.sosmesh.android.core.design.components.SosCall112Button
import com.sosmesh.android.core.design.components.SosMeshLogo
import com.sosmesh.android.core.design.theme.SosMeshTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], qualifiers = "tr")
class SosDesignBrandingRobolectricTest {
    @get:Rule
    val composeRule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun logo_isDisplayedWithContentDescription() {
        composeRule.setContent {
            SosMeshTheme {
                SosMeshLogo()
            }
        }
        composeRule.onNodeWithTag("sosmesh_logo").assertIsDisplayed()
        composeRule.onNodeWithContentDescription("SOSMesh logosu").assertIsDisplayed()
    }

    @Test
    fun call112Button_isVisibleWithAccessibilityLabel() {
        composeRule.setContent {
            SosMeshTheme {
                SosCall112Button()
            }
        }
        composeRule.onNodeWithTag("sos_call_112_button").assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Acil durumda 112'yi ara").assertIsDisplayed()
    }
}

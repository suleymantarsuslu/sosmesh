package com.sosmesh.android.feature.sos.ui

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import com.sosmesh.android.core.data.sos.LocationSnapshot
import com.sosmesh.android.feature.sos.R
import com.sosmesh.android.feature.sos.SosFormUiState
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], qualifiers = "w360dp-h640dp")
class SosA11yRobolectricTest {
    @get:Rule
    val composeRule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun primaryCta_isVisibleWithContentDescription() {
        composeRule.setContent {
            SosFlowScreen(
                state = SosFormUiState(gpsLocation = LocationSnapshot.unknown()),
                onSelectType = {},
                onPersonCountChange = {},
                onPersonUnknownChange = {},
                onNoteChange = {},
                onManualToggle = {},
                onManualLat = {},
                onManualLng = {},
                onContinue = {},
                onBackFromPreview = {},
                onConfirm = {},
            )
        }
        composeRule.onNodeWithTag("sos_primary_cta").assertIsDisplayed()
        val cd =
            composeRule.activity.getString(R.string.sos_cta_content_description)
        composeRule.onNodeWithContentDescription(cd).assertIsDisplayed()
    }
}

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], qualifiers = "w360dp-h640dp", fontScale = 2f)
class SosLargeFontRobolectricTest {
    @get:Rule
    val composeRule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun primaryCta_visibleAtFontScale2() {
        composeRule.setContent {
            SosFlowScreen(
                state = SosFormUiState(canContinue = true),
                onSelectType = {},
                onPersonCountChange = {},
                onPersonUnknownChange = {},
                onNoteChange = {},
                onManualToggle = {},
                onManualLat = {},
                onManualLng = {},
                onContinue = {},
                onBackFromPreview = {},
                onConfirm = {},
            )
        }
        composeRule.onNodeWithTag("sos_primary_cta").assertIsDisplayed()
    }
}

package com.sosmesh.android.feature.sos.ui

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performScrollTo
import com.sosmesh.android.core.data.sos.LocationSnapshot
import com.sosmesh.android.core.design.theme.SosMeshTheme
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
    fun continueButton_isVisibleOnGuidedForm() {
        composeRule.setContent {
            SosMeshTheme {
                SosFlowScreen(
                    state = SosFormUiState(gpsLocation = LocationSnapshot.unknown()),
                    onSelectType = {},
                    onPersonCountChange = {},
                    onPersonUnknownChange = {},
                    onNoteChange = {},
                    onManualToggle = {},
                    onManualLat = {},
                    onManualLng = {},
                    onPhotoSelected = {},
                    onVoiceRecorded = {},
                    onStartRecording = {},
                    onStopRecording = {},
                    onContinue = {},
                    onBackFromPreview = {},
                    onConfirm = {},
                )
            }
        }
        composeRule.onNodeWithTag("sosmesh_logo").assertIsDisplayed()
        composeRule.onNodeWithTag("sos_call_112_button").assertIsDisplayed()
        composeRule.onNodeWithTag("sos_continue_button").performScrollTo().assertIsDisplayed()
    }

    @Test
    fun call112Button_isVisibleOnGuidedForm() {
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
                onPhotoSelected = {},
                onVoiceRecorded = {},
                onStartRecording = {},
                onStopRecording = {},
                onContinue = {},
                onBackFromPreview = {},
                onConfirm = {},
            )
        }
        composeRule.onNodeWithTag("sos_call_112_button").performScrollTo().assertIsDisplayed()
    }
}

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], qualifiers = "w360dp-h640dp", fontScale = 2f)
class SosLargeFontRobolectricTest {
    @get:Rule
    val composeRule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun continueButton_visibleAtFontScale2() {
        composeRule.setContent {
            SosMeshTheme {
                SosFlowScreen(
                    state = SosFormUiState(canContinue = true),
                    onSelectType = {},
                    onPersonCountChange = {},
                    onPersonUnknownChange = {},
                    onNoteChange = {},
                    onManualToggle = {},
                    onManualLat = {},
                    onManualLng = {},
                    onPhotoSelected = {},
                    onVoiceRecorded = {},
                    onStartRecording = {},
                    onStopRecording = {},
                    onContinue = {},
                    onBackFromPreview = {},
                    onConfirm = {},
                )
            }
        }
        composeRule.onNodeWithTag("sos_continue_button").performScrollTo().assertIsDisplayed()
    }
}

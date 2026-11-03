package com.sosmesh.android.wear.ui

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import com.sosmesh.android.core.design.theme.SosMeshTheme
import com.sosmesh.android.core.wear.companion.queue.InMemoryWearOfflineQueueStore
import com.sosmesh.android.core.wear.companion.transport.WearCompanionTransport
import com.sosmesh.android.core.wear.companion.watch.WearSosCoordinator
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [30], qualifiers = "w450dp-h450dp-round")
class WearRootScreenRoundRobolectricTest {
    @get:Rule
    val composeRule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun sosTouchTarget_visibleOnRoundLayout() {
        val viewModel = WearSosViewModel(WearSosCoordinator(InMemoryWearOfflineQueueStore(), ReachableTransport()))
        composeRule.setContent {
            SosMeshTheme {
                WearRootScreen(viewModel = viewModel)
            }
        }
        composeRule.onNodeWithTag("wear_sosmesh_logo").assertIsDisplayed()
        composeRule.onNodeWithTag("wear_sos_touch_target").assertIsDisplayed()
        composeRule.onNodeWithTag("wear_not112_disclaimer").assertIsDisplayed()
    }

    private class ReachableTransport : WearCompanionTransport {
        override fun isPhoneReachable(): Boolean = true

        override fun sendCreateToPhone(
            payload: ByteArray,
            onSuccess: () -> Unit,
            onFailure: (String) -> Unit,
        ) {
            onSuccess()
        }

        override fun sendCreateToNode(
            nodeId: String,
            payload: ByteArray,
            onSuccess: () -> Unit,
            onFailure: (String) -> Unit,
        ) {
            sendCreateToPhone(payload, onSuccess, onFailure)
        }
    }
}

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [30], qualifiers = "w450dp-h450dp-round", fontScale = 2f)
class WearRootScreenLargeFontRobolectricTest {
    @get:Rule
    val composeRule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun headlineAndDisclaimer_visibleAtFontScale2() {
        val viewModel = WearSosViewModel(WearSosCoordinator(InMemoryWearOfflineQueueStore(), ReachableTransport()))
        composeRule.setContent {
            SosMeshTheme {
                WearRootScreen(viewModel = viewModel)
            }
        }
        composeRule.onNodeWithTag("wear_status_headline").assertIsDisplayed()
        composeRule.onNodeWithTag("wear_not112_disclaimer").assertIsDisplayed()
    }

    private class ReachableTransport : WearCompanionTransport {
        override fun isPhoneReachable(): Boolean = true

        override fun sendCreateToPhone(
            payload: ByteArray,
            onSuccess: () -> Unit,
            onFailure: (String) -> Unit,
        ) {
            onSuccess()
        }

        override fun sendCreateToNode(
            nodeId: String,
            payload: ByteArray,
            onSuccess: () -> Unit,
            onFailure: (String) -> Unit,
        ) {
            sendCreateToPhone(payload, onSuccess, onFailure)
        }
    }
}

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [30], qualifiers = "w450dp-h450dp-round")
class WearRootScreenAmbientRobolectricTest {
    @get:Rule
    val composeRule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun ambientMode_hidesSecondaryDetailTag() {
        val viewModel = WearSosViewModel(WearSosCoordinator(InMemoryWearOfflineQueueStore(), ReachableTransport()))
        viewModel.applyAmbientMode(true)
        composeRule.setContent {
            SosMeshTheme {
                WearRootScreen(viewModel = viewModel)
            }
        }
        composeRule.onNodeWithTag("wear_status_headline").assertIsDisplayed()
        composeRule.onNodeWithTag("wear_status_detail").assertDoesNotExist()
    }

    private class ReachableTransport : WearCompanionTransport {
        override fun isPhoneReachable(): Boolean = true

        override fun sendCreateToPhone(
            payload: ByteArray,
            onSuccess: () -> Unit,
            onFailure: (String) -> Unit,
        ) {
            onSuccess()
        }

        override fun sendCreateToNode(
            nodeId: String,
            payload: ByteArray,
            onSuccess: () -> Unit,
            onFailure: (String) -> Unit,
        ) {
            sendCreateToPhone(payload, onSuccess, onFailure)
        }
    }
}

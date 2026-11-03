package com.sosmesh.android.core.permissions.ui

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import com.sosmesh.android.core.design.components.SosMeshLogo
import com.sosmesh.android.core.design.components.SosNot112Banner
import com.sosmesh.android.core.design.components.SosScreenScaffold
import com.sosmesh.android.core.design.components.SosScrollableScreenContent
import com.sosmesh.android.core.design.theme.SosSpacing
import com.sosmesh.android.core.permissions.PermissionRequestOutcome
import com.sosmesh.android.core.permissions.R

data class PermissionScreenState(
    val rationaleMessage: String,
    val outcome: PermissionRequestOutcome?,
    val showSettingsAction: Boolean,
)

@Composable
fun PermissionRationaleScreen(
    state: PermissionScreenState,
    onRequestPermission: () -> Unit,
    onOpenSettings: () -> Unit,
    modifier: Modifier = Modifier,
    onNavigateBack: (() -> Unit)? = null,
) {
    SosScreenScaffold(
        title = stringResource(R.string.permission_screen_title),
        modifier = modifier,
        onNavigateBack = onNavigateBack,
    ) { contentModifier ->
        SosScrollableScreenContent(contentModifier) {
            SosMeshLogo(size = SosSpacing.xl + SosSpacing.lg)
            SosNot112Banner(
                disclaimerText = stringResource(R.string.permission_disclaimer_not112),
            )
            Text(text = state.rationaleMessage, style = MaterialTheme.typography.bodyLarge)
            val requestLabel = stringResource(R.string.permission_request_button)
            Button(
                onClick = onRequestPermission,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = SosSpacing.touchMin)
                        .testTag("permission_request_button")
                        .semantics {
                            contentDescription = requestLabel
                            role = Role.Button
                        },
            ) {
                Text(requestLabel)
            }
            if (state.showSettingsAction) {
                val settingsLabel = stringResource(R.string.permission_open_settings_button)
                Button(
                    onClick = onOpenSettings,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .heightIn(min = SosSpacing.touchMin)
                            .testTag("permission_settings_button")
                            .semantics {
                                contentDescription = settingsLabel
                                role = Role.Button
                            },
                ) {
                    Text(settingsLabel)
                }
            }
            Spacer(modifier = Modifier.height(SosSpacing.xs))
            Text(
                text = stringResource(R.string.background_no_guarantee),
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

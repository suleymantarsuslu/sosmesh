package com.sosmesh.android.core.permissions.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
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
import androidx.compose.ui.unit.dp
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
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text = stringResource(R.string.permission_disclaimer_not112),
            style = MaterialTheme.typography.bodyMedium,
        )
        Text(text = state.rationaleMessage, style = MaterialTheme.typography.bodyLarge)
        val requestLabel = stringResource(R.string.permission_request_button)
        Button(
            onClick = onRequestPermission,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
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
                        .heightIn(min = 48.dp)
                        .testTag("permission_settings_button")
                        .semantics {
                            contentDescription = settingsLabel
                            role = Role.Button
                        },
            ) {
                Text(settingsLabel)
            }
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = stringResource(R.string.background_no_guarantee),
            style = MaterialTheme.typography.bodySmall,
        )
    }
}

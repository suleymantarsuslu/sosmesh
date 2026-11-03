package com.sosmesh.android.core.permissions.ui

import android.Manifest
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import com.sosmesh.android.core.permissions.PermissionGateEvaluator
import com.sosmesh.android.core.permissions.R

data class PermissionGateUiState(
    val evaluation: PermissionGateEvaluator.PermissionGateEvaluation,
    val runtimePermissions: List<String>,
    val grantedPermissions: Set<String>,
)

@Composable
fun PermissionGateScreen(
    state: PermissionGateUiState,
    onRequestRuntimePermissions: () -> Unit,
    onOpenSettings: () -> Unit,
    onEnableBluetooth: () -> Unit,
    onOpenLocationSettings: () -> Unit,
    onCallEmergency: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxSize()
                .padding(24.dp)
                .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text = stringResource(R.string.permission_gate_title),
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.testTag("permission_gate_title"),
        )
        Text(
            text = stringResource(R.string.permission_gate_intro),
            style = MaterialTheme.typography.bodyMedium,
        )
        Text(
            text = stringResource(R.string.permission_disclaimer_not112),
            style = MaterialTheme.typography.bodyMedium,
        )
        state.runtimePermissions.forEach { permission ->
            val granted = permission in state.grantedPermissions
            val rationale = permissionRationaleFor(permission)
            val status =
                if (granted) {
                    stringResource(R.string.permission_gate_status_granted)
                } else {
                    stringResource(R.string.permission_gate_status_missing)
                }
            Text(
                text = "$rationale\n$status",
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.testTag("permission_gate_row_$permission"),
            )
        }
        if (!state.evaluation.bluetoothEnabled) {
            Text(
                text = stringResource(R.string.permission_bluetooth_adapter_off),
                style = MaterialTheme.typography.bodySmall,
            )
        }
        if (state.evaluation.needsLocationServices) {
            Text(
                text = stringResource(R.string.permission_location_services_off),
                style = MaterialTheme.typography.bodySmall,
            )
        }
        val blocker = state.evaluation.primaryBlocker()
        when (blocker) {
            is PermissionGateEvaluator.PermissionGateBlocker.RuntimePermissions -> {
                val requestLabel = stringResource(R.string.permission_request_button)
                Button(
                    onClick = onRequestRuntimePermissions,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .heightIn(min = 48.dp)
                            .testTag("permission_gate_request_button")
                            .semantics {
                                contentDescription = requestLabel
                                role = Role.Button
                            },
                ) {
                    Text(requestLabel)
                }
                if (blocker.settingsRequired) {
                    val settingsLabel = stringResource(R.string.permission_open_settings_button)
                    Button(
                        onClick = onOpenSettings,
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .heightIn(min = 48.dp)
                                .testTag("permission_gate_settings_button")
                                .semantics {
                                    contentDescription = settingsLabel
                                    role = Role.Button
                                },
                    ) {
                        Text(settingsLabel)
                    }
                }
            }
            PermissionGateEvaluator.PermissionGateBlocker.BluetoothDisabled -> {
                val label = stringResource(R.string.permission_enable_bluetooth_button)
                Button(
                    onClick = onEnableBluetooth,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .heightIn(min = 48.dp)
                            .testTag("permission_gate_bluetooth_button")
                            .semantics {
                                contentDescription = label
                                role = Role.Button
                            },
                ) {
                    Text(label)
                }
            }
            PermissionGateEvaluator.PermissionGateBlocker.LocationServicesDisabled -> {
                val label = stringResource(R.string.permission_enable_location_services_button)
                Button(
                    onClick = onOpenLocationSettings,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .heightIn(min = 48.dp)
                            .testTag("permission_gate_location_button")
                            .semantics {
                                contentDescription = label
                                role = Role.Button
                            },
                ) {
                    Text(label)
                }
            }
            null -> Unit
        }
        Spacer(modifier = Modifier.height(8.dp))
        val call112Label = stringResource(R.string.permission_call_112_button)
        Button(
            onClick = onCallEmergency,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .testTag("permission_gate_call_112_button")
                    .semantics {
                        contentDescription = call112Label
                        role = Role.Button
                    },
        ) {
            Text(call112Label)
        }
        Text(
            text = stringResource(R.string.background_no_guarantee),
            style = MaterialTheme.typography.bodySmall,
        )
    }
}

@Composable
fun permissionRationaleFor(
    permission: String,
): String {
    val res =
        when (permission) {
            Manifest.permission.BLUETOOTH_SCAN -> R.string.permission_bluetooth_scan_rationale
            Manifest.permission.BLUETOOTH_CONNECT -> R.string.permission_bluetooth_connect_rationale
            Manifest.permission.BLUETOOTH_ADVERTISE -> R.string.permission_bluetooth_advertise_rationale
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
            -> R.string.permission_location_rationale
            Manifest.permission.POST_NOTIFICATIONS -> R.string.permission_notification_rationale
            else -> R.string.permission_bluetooth_rationale
        }
    return stringResource(res)
}

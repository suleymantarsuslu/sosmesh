package com.sosmesh.android.core.permissions.ui

import android.Manifest
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bluetooth
import androidx.compose.material.icons.filled.BluetoothDisabled
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.LocationOff
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalContext
import com.sosmesh.android.core.design.components.SosBadge
import com.sosmesh.android.core.design.components.SosBadgeKind
import com.sosmesh.android.core.design.components.SosCall112Button
import com.sosmesh.android.core.design.components.SosIconCard
import com.sosmesh.android.core.design.components.SosMeshLogo
import com.sosmesh.android.core.design.components.SosNot112Banner
import com.sosmesh.android.core.design.components.SosPrimaryButton
import com.sosmesh.android.core.design.components.SosSecondaryButton
import com.sosmesh.android.core.design.emergency.EmergencyNumberProvider
import com.sosmesh.android.core.design.theme.SosIosColors
import com.sosmesh.android.core.design.theme.SosSpacing
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
    val context = LocalContext.current
    val emergencyNumber = EmergencyNumberProvider.getEmergencyNumber(context)
    Column(
        modifier =
            modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .verticalScroll(rememberScrollState())
                .padding(SosSpacing.md),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(SosSpacing.md),
    ) {
        SosMeshLogo(size = 72.dp, modifier = Modifier.padding(top = SosSpacing.md))
        Text(
            text = stringResource(R.string.permission_gate_title),
            style = MaterialTheme.typography.headlineMedium,
            textAlign = TextAlign.Center,
            modifier =
                Modifier
                    .testTag("permission_gate_title")
                    .semantics { heading() },
        )
        SosNot112Banner(disclaimerText = stringResource(R.string.permission_disclaimer_not112, emergencyNumber))
        Text(
            text = stringResource(R.string.permission_gate_intro),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        // Fine and coarse location share one rationale; show a single card per rationale.
        val seen = mutableSetOf<Int>()
        state.runtimePermissions.forEach { permission ->
            val granted = permission in state.grantedPermissions
            val rationaleRes = permissionRationaleResFor(permission)
            if (!seen.add(rationaleRes)) return@forEach
            val rationale = stringResource(rationaleRes)
            val statusText =
                if (granted) {
                    stringResource(R.string.permission_gate_status_granted)
                } else {
                    stringResource(R.string.permission_gate_status_missing)
                }
            SosIconCard(
                icon = permissionIconFor(permission),
                iconTint = if (granted) SosIosColors.SuccessGreen else SosIosColors.AccentBlueText,
                highlighted = !granted,
                modifier =
                    Modifier
                        .testTag("permission_gate_row_$permission")
                        .semantics(mergeDescendants = true) {},
            ) {
                Text(text = rationale, style = MaterialTheme.typography.bodyMedium)
                SosBadge(
                    kind = if (granted) SosBadgeKind.Success else SosBadgeKind.Pending,
                    text = statusText,
                    modifier = Modifier.padding(top = SosSpacing.xxs),
                )
            }
        }
        if (!state.evaluation.bluetoothEnabled) {
            SosIconCard(
                icon = Icons.Filled.BluetoothDisabled,
                iconTint = SosIosColors.WarningOrange,
                highlighted = true,
                accent = SosIosColors.WarningOrange,
            ) {
                Text(
                    text = stringResource(R.string.permission_bluetooth_adapter_off),
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
        if (state.evaluation.needsLocationServices) {
            SosIconCard(
                icon = Icons.Filled.LocationOff,
                iconTint = SosIosColors.WarningOrange,
                highlighted = true,
                accent = SosIosColors.WarningOrange,
            ) {
                Text(
                    text = stringResource(R.string.permission_location_services_off),
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
        val blocker = state.evaluation.primaryBlocker()
        when (blocker) {
            is PermissionGateEvaluator.PermissionGateBlocker.RuntimePermissions -> {
                val requestLabel = stringResource(R.string.permission_request_button)
                SosPrimaryButton(
                    text = requestLabel,
                    onClick = onRequestRuntimePermissions,
                    icon = Icons.Filled.Check,
                    testTag = "permission_gate_request_button",
                )
                if (blocker.settingsRequired) {
                    val settingsLabel = stringResource(R.string.permission_open_settings_button)
                    SosSecondaryButton(
                        text = settingsLabel,
                        onClick = onOpenSettings,
                        icon = Icons.Filled.Settings,
                        testTag = "permission_gate_settings_button",
                    )
                }
            }
            PermissionGateEvaluator.PermissionGateBlocker.BluetoothDisabled -> {
                SosPrimaryButton(
                    text = stringResource(R.string.permission_enable_bluetooth_button),
                    onClick = onEnableBluetooth,
                    icon = Icons.Filled.Bluetooth,
                    testTag = "permission_gate_bluetooth_button",
                )
            }
            PermissionGateEvaluator.PermissionGateBlocker.LocationServicesDisabled -> {
                SosPrimaryButton(
                    text = stringResource(R.string.permission_enable_location_services_button),
                    onClick = onOpenLocationSettings,
                    icon = Icons.Filled.LocationOn,
                    testTag = "permission_gate_location_button",
                )
            }
            null -> Unit
        }
        SosCall112Button(testTag = "permission_gate_call_112_button")
        Text(
            text = stringResource(R.string.background_no_guarantee),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
    }
}

private fun permissionIconFor(permission: String): ImageVector =
    when (permission) {
        Manifest.permission.BLUETOOTH_SCAN,
        Manifest.permission.BLUETOOTH_CONNECT,
        Manifest.permission.BLUETOOTH_ADVERTISE,
        -> Icons.Filled.Bluetooth
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.ACCESS_COARSE_LOCATION,
        -> Icons.Filled.LocationOn
        Manifest.permission.POST_NOTIFICATIONS -> Icons.Filled.Notifications
        else -> Icons.Filled.Bluetooth
    }

@Composable
fun permissionRationaleFor(permission: String): String = stringResource(permissionRationaleResFor(permission))

private fun permissionRationaleResFor(permission: String): Int =
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

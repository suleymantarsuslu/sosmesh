package com.sosmesh.android.ui.gate

import android.app.Activity
import android.bluetooth.BluetoothAdapter
import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.sosmesh.android.core.ble.platform.BluetoothAdapterPort
import com.sosmesh.android.core.permissions.AppSettingsIntents
import com.sosmesh.android.core.permissions.BlePermissionMatrix
import com.sosmesh.android.core.permissions.EmergencyDialIntents
import com.sosmesh.android.core.permissions.LocationSettingsIntents
import com.sosmesh.android.core.permissions.PermissionFlowCoordinator
import com.sosmesh.android.core.permissions.PermissionGateEvaluator
import com.sosmesh.android.core.permissions.ui.PermissionGateScreen
import com.sosmesh.android.core.permissions.ui.PermissionGateUiState
import com.sosmesh.android.platform.MeshPlatformSignalBridge
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent

@EntryPoint
@InstallIn(SingletonComponent::class)
interface PermissionGateEntryPoint {
    fun permissionFlowCoordinator(): PermissionFlowCoordinator

    fun meshPlatformSignalBridge(): MeshPlatformSignalBridge

    fun bluetoothAdapterPort(): BluetoothAdapterPort
}

@Composable
fun PermissionGateRoute(
    onGatePassed: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val activity = context as Activity
    val entryPoint =
        remember {
            EntryPointAccessors.fromApplication(
                context.applicationContext,
                PermissionGateEntryPoint::class.java,
            )
        }
    val coordinator = remember { entryPoint.permissionFlowCoordinator() }
    val platformBridge = remember { entryPoint.meshPlatformSignalBridge() }
    val bluetoothEnabled = remember { { entryPoint.bluetoothAdapterPort().isEnabled() } }
    var permanentDenials by remember { mutableStateOf(setOf<String>()) }

    fun buildUiState(): PermissionGateUiState {
        val sdkInt = android.os.Build.VERSION.SDK_INT
        val missing = coordinator.missingPermissions()
        val evaluation =
            PermissionGateEvaluator.evaluate(
                sdkInt = sdkInt,
                missingRuntimePermissions = missing,
                bluetoothEnabled = bluetoothEnabled(),
                locationServicesEnabled = platformBridge.locationServicesAvailable(),
                permanentlyDeniedPermissions = permanentDenials,
            )
        val matrix = BlePermissionMatrix.runtimePermissions(sdkInt).permissions.toList()
        val granted = matrix.filterNot { it in missing }.toSet()
        return PermissionGateUiState(
            evaluation = evaluation,
            runtimePermissions = matrix,
            grantedPermissions = granted,
        )
    }

    var uiState by remember { mutableStateOf(buildUiState()) }

    fun refreshGate() {
        uiState = buildUiState()
        if (uiState.evaluation.canEnterApp) {
            onGatePassed()
        }
    }

    LaunchedEffect(Unit) {
        refreshGate()
    }

    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer =
            LifecycleEventObserver { _, event ->
                if (event == Lifecycle.Event.ON_RESUME) {
                    refreshGate()
                }
            }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    val permissionLauncher =
        rememberLauncherForActivityResult(
            ActivityResultContracts.RequestMultiplePermissions(),
        ) { results ->
            val missing = coordinator.missingPermissions()
            missing.forEach { permission ->
                if (results[permission] != true) {
                    val canRetry = activity.shouldShowRequestPermissionRationale(permission)
                    if (!canRetry) {
                        permanentDenials = permanentDenials + permission
                    }
                }
            }
            refreshGate()
        }

    val bluetoothLauncher =
        rememberLauncherForActivityResult(
            ActivityResultContracts.StartActivityForResult(),
        ) {
            refreshGate()
        }

    PermissionGateScreen(
        state = uiState,
        onRequestRuntimePermissions = {
            val missing = coordinator.missingPermissions()
            if (missing.isEmpty()) {
                refreshGate()
            } else {
                permissionLauncher.launch(missing.toTypedArray())
            }
        },
        onOpenSettings = {
            context.startActivity(AppSettingsIntents.applicationDetails(context))
        },
        onEnableBluetooth = {
            val intent = Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE)
            bluetoothLauncher.launch(intent)
        },
        onOpenLocationSettings = {
            context.startActivity(LocationSettingsIntents.locationSourceSettings())
        },
        onCallEmergency = {
            context.startActivity(EmergencyDialIntents.dial112(context))
        },
        modifier = modifier,
    )
}

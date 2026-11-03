package com.sosmesh.android.ui.permissions

import android.app.Activity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import com.sosmesh.android.core.permissions.AppSettingsIntents
import com.sosmesh.android.core.permissions.PermissionFlowCoordinator
import com.sosmesh.android.core.permissions.PermissionRequestOutcome
import com.sosmesh.android.core.permissions.R
import com.sosmesh.android.core.design.components.SosLanguagePicker
import com.sosmesh.android.locale.AppLocaleController
import com.sosmesh.android.core.permissions.ui.PermissionRationaleScreen
import com.sosmesh.android.core.permissions.ui.PermissionScreenState
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent

@EntryPoint
@InstallIn(SingletonComponent::class)
interface PermissionsEntryPoint {
    fun permissionFlowCoordinator(): PermissionFlowCoordinator
}

@Composable
fun PermissionsRoute(onBack: () -> Unit) {
    val context = LocalContext.current
    val activity = context as Activity
    val coordinator =
        remember {
            EntryPointAccessors.fromApplication(
                context.applicationContext,
                PermissionsEntryPoint::class.java,
            ).permissionFlowCoordinator()
        }
    val defaultBluetoothRationale = stringResource(R.string.permission_bluetooth_rationale)
    var rationaleMessage by remember { mutableStateOf(defaultBluetoothRationale) }
    var outcome by remember { mutableStateOf<PermissionRequestOutcome?>(null) }
    var showSettings by remember { mutableStateOf(false) }

    val launcher =
        rememberLauncherForActivityResult(
            ActivityResultContracts.RequestMultiplePermissions(),
        ) { results ->
            val missing = coordinator.missingPermissions()
            if (missing.isEmpty()) {
                onBack()
                return@rememberLauncherForActivityResult
            }
            val perm = missing.first()
            val granted = results[perm] == true
            if (granted) {
                outcome = PermissionRequestOutcome.GRANTED
                showSettings = false
            } else {
                val canRetry = activity.shouldShowRequestPermissionRationale(perm)
                outcome =
                    if (canRetry) {
                        PermissionRequestOutcome.DENIED_CAN_RETRY
                    } else {
                        PermissionRequestOutcome.PERMANENTLY_DENIED
                    }
                showSettings = outcome == PermissionRequestOutcome.PERMANENTLY_DENIED
            }
        }

    PermissionRationaleScreen(
        state =
            PermissionScreenState(
                rationaleMessage = rationaleMessage,
                outcome = outcome,
                showSettingsAction = showSettings,
            ),
        onRequestPermission = {
            val next = coordinator.nextMissingPermission()
            if (next == null) {
                onBack()
            } else {
                rationaleMessage =
                    when {
                        next.contains("LOCATION") ->
                            context.getString(R.string.permission_location_rationale)
                        next.contains("POST_NOTIFICATIONS") ->
                            context.getString(R.string.permission_notification_rationale)
                        else -> context.getString(R.string.permission_bluetooth_rationale)
                    }
                launcher.launch(coordinator.missingPermissions().toTypedArray())
            }
        },
        onOpenSettings = {
            context.startActivity(AppSettingsIntents.applicationDetails(context))
        },
        onNavigateBack = onBack,
        languagePicker = {
            SosLanguagePicker(
                selectedLanguageTag = AppLocaleController.readStoredTag(context),
                onLanguageSelected = { tag ->
                    AppLocaleController.setApplicationLanguage(context.applicationContext, tag)
                },
            )
        },
    )
}

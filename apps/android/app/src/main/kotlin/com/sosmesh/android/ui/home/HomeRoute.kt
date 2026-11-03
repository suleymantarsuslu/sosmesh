package com.sosmesh.android.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.sosmesh.android.BuildConfig
import com.sosmesh.android.R
import com.sosmesh.android.core.permissions.ui.EmergencyCall112Button

@Composable
fun HomeRoute(
    onOpenPermissions: () -> Unit,
    onOpenRadioDebug: () -> Unit,
    onOpenSos: () -> Unit,
    onOpenStatus: () -> Unit,
    onOpenRelay: () -> Unit,
    onOpenSettings: () -> Unit,
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()
    LaunchedEffect(Unit) {
        viewModel.refreshPlatform()
    }
    HomeScreen(
        state = state,
        onOpenPermissions = onOpenPermissions,
        onOpenRadioDebug = onOpenRadioDebug,
        onOpenSos = onOpenSos,
        onOpenStatus = onOpenStatus,
        onOpenRelay = onOpenRelay,
        onOpenSettings = onOpenSettings,
        onExpressSos = { viewModel.expressSaveSos() },
    )
}

@Composable
internal fun HomeScreen(
    state: HomeUiState,
    onOpenPermissions: () -> Unit,
    onOpenRadioDebug: () -> Unit,
    onOpenSos: () -> Unit,
    onOpenStatus: () -> Unit,
    onOpenRelay: () -> Unit,
    onOpenSettings: () -> Unit,
    onExpressSos: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        DemoModeLabel(visible = BuildConfig.SHOW_DEMO_MODE_LABEL)
        Text(text = stringResource(R.string.home_title), style = MaterialTheme.typography.headlineMedium)
        Text(
            text = stringResource(com.sosmesh.android.core.permissions.R.string.permission_disclaimer_not112),
            style = MaterialTheme.typography.bodyMedium,
        )
        EmergencyCall112Button(modifier = Modifier.fillMaxWidth(), testTag = "home_call_112_button")
        PlatformSelfRepairCard(hint = state.platformHint, onOpenPermissions = onOpenPermissions)
        CrossPlatformFaultCard(hint = state.crossPlatformFault, onOpenPermissions = onOpenPermissions)
        ExpressSosButton(onClick = onExpressSos)
        state.expressSavedMessageId?.let {
            Text(
                text = stringResource(R.string.home_express_saved),
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.testTag("home_express_saved"),
            )
        }
        OutlinedButton(onClick = onOpenSos, modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp)) {
            Text(stringResource(R.string.home_guided_sos_cta))
        }
        RelayEducationCard(onOpenRelay = onOpenRelay)
        OutlinedButton(onClick = onOpenStatus, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.home_status_cta))
        }
        OutlinedButton(onClick = onOpenRelay, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.home_relay_cta))
        }
        OutlinedButton(onClick = onOpenPermissions, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.home_permissions_cta))
        }
        OutlinedButton(onClick = onOpenSettings, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.home_settings_cta))
        }
        OutlinedButton(onClick = onOpenRadioDebug, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.home_radio_debug_cta))
        }
    }
}

@Composable
private fun ExpressSosButton(onClick: () -> Unit) {
    val label = stringResource(R.string.home_express_sos_cta)
    val cd = stringResource(R.string.home_express_sos_content_description)
    Button(
        onClick = onClick,
        modifier =
            Modifier
                .fillMaxWidth()
                .height(72.dp)
                .testTag("home_express_sos_button")
                .semantics {
                    contentDescription = cd
                    role = Role.Button
                },
    ) {
        Text(label, style = MaterialTheme.typography.headlineMedium)
    }
}

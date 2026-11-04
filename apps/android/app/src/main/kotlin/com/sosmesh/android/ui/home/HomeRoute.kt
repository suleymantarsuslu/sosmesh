package com.sosmesh.android.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Sensors
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.sosmesh.android.BuildConfig
import com.sosmesh.android.R
import com.sosmesh.android.core.design.components.SosBadge
import com.sosmesh.android.core.design.components.SosBadgeKind
import com.sosmesh.android.core.design.components.SosCall112Button
import com.sosmesh.android.core.design.components.SosExpressSosButton
import com.sosmesh.android.core.design.components.SosSecondaryButton
import com.sosmesh.android.core.design.components.SosMeshLogo
import com.sosmesh.android.core.design.components.SosNot112Banner
import com.sosmesh.android.core.design.components.SosScreenScaffold
import com.sosmesh.android.core.design.components.SosScrollableScreenContent
import com.sosmesh.android.core.design.components.SosStatusCard
import com.sosmesh.android.core.design.theme.SosIosColors
import com.sosmesh.android.core.design.theme.SosSpacing

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
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun HomeScreen(
    state: HomeUiState,
    onOpenPermissions: () -> Unit,
    onOpenRadioDebug: () -> Unit,
    onOpenSos: () -> Unit,
    onOpenStatus: () -> Unit,
    onOpenRelay: () -> Unit,
    onOpenSettings: () -> Unit,
) {
    SosScreenScaffold(
        title = stringResource(R.string.home_title),
        showLogoInTopBar = true,
    ) { contentModifier ->
        SosScrollableScreenContent(contentModifier, spacing = SosSpacing.md) {
            DemoModeLabel(visible = BuildConfig.SHOW_DEMO_MODE_LABEL)
            Column(
                modifier = Modifier.fillMaxWidth().padding(top = SosSpacing.xs),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(SosSpacing.xs),
            ) {
                SosMeshLogo(size = 72.dp)
                Text(
                    text = stringResource(R.string.app_tagline),
                    style = MaterialTheme.typography.headlineMedium,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.semantics { heading() },
                )
            }
            SosNot112Banner(
                disclaimerText =
                    stringResource(
                        com.sosmesh.android.core.permissions.R.string.permission_disclaimer_not112,
                    ),
            )
            SosExpressSosButton(
                label = stringResource(R.string.home_express_sos_cta),
                contentDescription = stringResource(R.string.home_express_sos_content_description),
                onClick = onOpenSos,
            )
            SosCall112Button(testTag = "home_call_112_button")
            SosSecondaryButton(
                text = stringResource(R.string.home_guided_sos_cta),
                onClick = onOpenSos,
                icon = Icons.Filled.Edit,
            )
            MeshStatusCard(state = state, onOpenStatus = onOpenStatus)
            PlatformSelfRepairCard(hint = state.platformHint, onOpenPermissions = onOpenPermissions)
            CrossPlatformFaultCard(hint = state.crossPlatformFault, onOpenPermissions = onOpenPermissions)
            RelayEducationCard(onOpenRelay = onOpenRelay)
            if (BuildConfig.DEBUG) {
                SosSecondaryButton(
                    text = stringResource(R.string.home_radio_debug_cta),
                    onClick = onOpenRadioDebug,
                )
            }
        }
    }
}

/** Mesh state as status chips: internet, relay, queued and server-reached counts. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun MeshStatusCard(
    state: HomeUiState,
    onOpenStatus: () -> Unit,
) {
    SosStatusCard(modifier = Modifier.testTag("home_mesh_status_card")) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(SosSpacing.xs),
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.TrendingUp,
                contentDescription = null,
                tint = SosIosColors.AccentBlueText,
            )
            Text(
                text = stringResource(R.string.home_mesh_status_title),
                style = MaterialTheme.typography.titleMedium,
            )
        }
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(SosSpacing.xs),
            verticalArrangement = Arrangement.spacedBy(SosSpacing.xs),
        ) {
            SosBadge(
                kind = if (state.online) SosBadgeKind.Success else SosBadgeKind.Warning,
                text = stringResource(if (state.online) R.string.home_chip_online else R.string.home_chip_offline),
            )
            SosBadge(
                kind = if (state.relayEnabled) SosBadgeKind.Success else SosBadgeKind.Neutral,
                text = stringResource(if (state.relayEnabled) R.string.home_chip_relay_on else R.string.home_chip_relay_off),
                icon = Icons.Filled.Sensors,
            )
            SosBadge(
                kind = if (state.queuedCount > 0) SosBadgeKind.Pending else SosBadgeKind.Neutral,
                text = stringResource(R.string.home_chip_queued, state.queuedCount),
            )
            SosBadge(
                kind = if (state.deliveredCount > 0) SosBadgeKind.Success else SosBadgeKind.Neutral,
                text = stringResource(R.string.home_chip_delivered, state.deliveredCount),
            )
        }
        SosSecondaryButton(
            text = stringResource(R.string.nav_status),
            onClick = onOpenStatus,
            modifier = Modifier.padding(top = SosSpacing.xs),
        )
    }
}

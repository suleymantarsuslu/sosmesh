package com.sosmesh.android.ui.home

import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
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
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.sosmesh.android.BuildConfig
import com.sosmesh.android.R
import com.sosmesh.android.core.design.components.SosExpressSosButton
import com.sosmesh.android.core.design.components.SosMeshLogo
import com.sosmesh.android.core.design.components.SosNot112Banner
import com.sosmesh.android.core.design.components.SosScreenScaffold
import com.sosmesh.android.core.design.components.SosScrollableScreenContent
import com.sosmesh.android.core.design.components.SosStatusCard
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

    SosScreenScaffold(
        title = stringResource(R.string.home_title),
        showLogoInTopBar = true,
    ) { contentModifier ->
        SosScrollableScreenContent(contentModifier) {
            DemoModeLabel(visible = BuildConfig.SHOW_DEMO_MODE_LABEL)
            SosMeshLogo(
                modifier = Modifier.fillMaxWidth().padding(vertical = SosSpacing.sm),
                size = 96.dp,
            )
            SosNot112Banner(
                disclaimerText =
                    stringResource(
                        com.sosmesh.android.core.permissions.R.string.permission_disclaimer_not112,
                    ),
            )
            PlatformSelfRepairCard(hint = state.platformHint, onOpenPermissions = onOpenPermissions)
            CrossPlatformFaultCard(hint = state.crossPlatformFault, onOpenPermissions = onOpenPermissions)
            SosExpressSosButton(
                label = stringResource(R.string.home_express_sos_cta),
                contentDescription = stringResource(R.string.home_express_sos_content_description),
                onClick = { viewModel.expressSaveSos() },
            )
            state.expressSavedMessageId?.let {
                SosStatusCard {
                    Text(
                        text = stringResource(R.string.home_express_saved),
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.testTag("home_express_saved"),
                    )
                }
            }
            OutlinedButton(
                onClick = onOpenSos,
                modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = SosSpacing.touchMin),
            ) {
                Text(stringResource(R.string.home_guided_sos_cta))
            }
            RelayEducationCard(onOpenRelay = onOpenRelay)
            HomeNavButton(label = stringResource(R.string.home_status_cta), onClick = onOpenStatus)
            HomeNavButton(label = stringResource(R.string.home_relay_cta), onClick = onOpenRelay)
            HomeNavButton(label = stringResource(R.string.home_permissions_cta), onClick = onOpenPermissions)
            HomeNavButton(label = stringResource(R.string.home_settings_cta), onClick = onOpenSettings)
            if (BuildConfig.DEBUG) {
                HomeNavButton(label = stringResource(R.string.home_radio_debug_cta), onClick = onOpenRadioDebug)
            }
        }
    }
}

@Composable
private fun HomeNavButton(
    label: String,
    onClick: () -> Unit,
) {
    OutlinedButton(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = SosSpacing.touchMin),
    ) {
        Text(label)
    }
}

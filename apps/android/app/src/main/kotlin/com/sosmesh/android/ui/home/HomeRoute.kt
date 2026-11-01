package com.sosmesh.android.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.sosmesh.android.BuildConfig
import com.sosmesh.android.R

@Composable
fun HomeRoute(
    onOpenPermissions: () -> Unit,
    onOpenRadioDebug: () -> Unit,
    onOpenSos: () -> Unit,
    onOpenStatus: () -> Unit,
    onOpenRelay: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        DemoModeLabel(visible = BuildConfig.SHOW_DEMO_MODE_LABEL)
        Text(text = stringResource(R.string.home_title), style = MaterialTheme.typography.headlineMedium)
        Text(
            text = stringResource(com.sosmesh.android.core.permissions.R.string.permission_disclaimer_not112),
            style = MaterialTheme.typography.bodyMedium,
        )
        Button(onClick = onOpenSos) {
            Text(stringResource(R.string.home_sos_cta))
        }
        Button(onClick = onOpenStatus) {
            Text(stringResource(R.string.home_status_cta))
        }
        Button(onClick = onOpenRelay) {
            Text(stringResource(R.string.home_relay_cta))
        }
        Button(onClick = onOpenPermissions) {
            Text(stringResource(R.string.home_permissions_cta))
        }
        Button(onClick = onOpenRadioDebug) {
            Text(stringResource(R.string.home_radio_debug_cta))
        }
    }
}

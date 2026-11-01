package com.sosmesh.android.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.sosmesh.android.R
import com.sosmesh.android.core.platform.PlatformUserHint

@Composable
fun PlatformSelfRepairCard(
    hint: PlatformUserHint,
    onOpenPermissions: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (hint == PlatformUserHint.NONE) {
        return
    }
    val message =
        when (hint) {
            PlatformUserHint.FIX_BLUETOOTH -> stringResource(R.string.platform_hint_bluetooth)
            PlatformUserHint.FIX_PERMISSIONS -> stringResource(R.string.platform_hint_permissions)
            PlatformUserHint.LOW_BATTERY_RELAY_PAUSED -> stringResource(R.string.platform_hint_low_battery)
            PlatformUserHint.NETWORK_OFFLINE_RELAY -> stringResource(R.string.platform_hint_network)
            PlatformUserHint.POWER_SAVE_CONSTRAINED -> stringResource(R.string.platform_hint_power_save)
            PlatformUserHint.NONE -> return
        }
    Card(
        modifier = modifier.fillMaxWidth().testTag("platform_self_repair_card"),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(text = stringResource(R.string.platform_self_repair_title), style = MaterialTheme.typography.titleSmall)
            Text(text = message, style = MaterialTheme.typography.bodyMedium)
            if (hint == PlatformUserHint.FIX_PERMISSIONS || hint == PlatformUserHint.FIX_BLUETOOTH) {
                OutlinedButton(onClick = onOpenPermissions, modifier = Modifier.fillMaxWidth()) {
                    Text(stringResource(R.string.platform_self_repair_action))
                }
            }
        }
    }
}

@Composable
fun RelayEducationCard(
    onOpenRelay: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(modifier = modifier.fillMaxWidth().testTag("relay_education_card")) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(stringResource(R.string.relay_education_title), style = MaterialTheme.typography.titleSmall)
            Text(stringResource(R.string.relay_education_body), style = MaterialTheme.typography.bodyMedium)
            Text(
                stringResource(com.sosmesh.android.core.permissions.R.string.background_no_guarantee),
                style = MaterialTheme.typography.bodySmall,
            )
            Button(onClick = onOpenRelay, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.relay_education_cta))
            }
        }
    }
}

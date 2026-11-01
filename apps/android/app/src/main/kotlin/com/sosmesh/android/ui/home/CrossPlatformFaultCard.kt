package com.sosmesh.android.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.sosmesh.android.R
import com.sosmesh.android.core.platform.CrossPlatformFaultHint

@Composable
fun CrossPlatformFaultCard(
    hint: CrossPlatformFaultHint,
    onOpenPermissions: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (hint == CrossPlatformFaultHint.NONE) {
        return
    }
    val messageRes =
        when (hint) {
            CrossPlatformFaultHint.FIX_BLUETOOTH -> R.string.platform_hint_bluetooth
            CrossPlatformFaultHint.FIX_PERMISSIONS -> R.string.platform_hint_permissions
            CrossPlatformFaultHint.LOCATION_UNAVAILABLE -> R.string.cross_platform_hint_location
            CrossPlatformFaultHint.TRANSFER_CORRUPT -> R.string.cross_platform_hint_corrupt
            CrossPlatformFaultHint.API_UPLOAD_FAILED -> R.string.cross_platform_hint_api
            CrossPlatformFaultHint.LOW_BATTERY_RELAY_PAUSED -> R.string.platform_hint_low_battery
            CrossPlatformFaultHint.NETWORK_OFFLINE_RELAY -> R.string.platform_hint_network
            CrossPlatformFaultHint.NONE -> return
        }
    val titleRes = R.string.cross_platform_fault_title
    val ariaText = stringResource(R.string.cross_platform_fault_aria)
    Card(
        modifier =
            modifier
                .fillMaxWidth()
                .testTag("cross_platform_fault_card")
                .semantics {
                    contentDescription = "cross_platform_fault_card"
                },
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = stringResource(titleRes),
                style = MaterialTheme.typography.titleSmall,
                modifier = Modifier.semantics { contentDescription = "cross_platform_fault_title" },
            )
            Text(
                text = stringResource(messageRes),
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.semantics { contentDescription = ariaText },
            )
            if (hint == CrossPlatformFaultHint.FIX_PERMISSIONS || hint == CrossPlatformFaultHint.FIX_BLUETOOTH) {
                OutlinedButton(onClick = onOpenPermissions, modifier = Modifier.fillMaxWidth()) {
                    Text(stringResource(R.string.platform_self_repair_action))
                }
            }
        }
    }
}

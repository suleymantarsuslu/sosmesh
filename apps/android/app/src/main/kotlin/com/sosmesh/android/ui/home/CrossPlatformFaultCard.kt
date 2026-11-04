package com.sosmesh.android.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import com.sosmesh.android.R
import com.sosmesh.android.core.design.components.SosCard
import com.sosmesh.android.core.design.components.SosSecondaryButton
import com.sosmesh.android.core.design.theme.SosIosColors
import com.sosmesh.android.core.design.theme.SosSpacing
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
    SosCard(
        modifier =
            modifier
                .testTag("cross_platform_fault_card")
                .semantics {
                    contentDescription = "cross_platform_fault_card"
                },
        highlighted = true,
        accent = SosIosColors.EmergencyRed,
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(SosSpacing.sm), verticalAlignment = Alignment.Top) {
            Icon(
                imageVector = Icons.Filled.Warning,
                contentDescription = null,
                tint = SosIosColors.WarningOrange,
            )
            Column(verticalArrangement = Arrangement.spacedBy(SosSpacing.xs)) {
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
            }
        }
        if (hint == CrossPlatformFaultHint.FIX_PERMISSIONS || hint == CrossPlatformFaultHint.FIX_BLUETOOTH) {
            SosSecondaryButton(
                text = stringResource(R.string.platform_self_repair_action),
                onClick = onOpenPermissions,
            )
        }
    }
}

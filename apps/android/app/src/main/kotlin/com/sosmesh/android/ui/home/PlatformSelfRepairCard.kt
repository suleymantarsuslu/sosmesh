package com.sosmesh.android.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Sensors
import androidx.compose.material.icons.filled.Warning
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import com.sosmesh.android.R
import com.sosmesh.android.core.design.components.SosCard
import com.sosmesh.android.core.design.components.SosIconCard
import com.sosmesh.android.core.design.components.SosPrimaryButton
import com.sosmesh.android.core.design.components.SosSecondaryButton
import com.sosmesh.android.core.design.theme.SosIosColors
import com.sosmesh.android.core.design.theme.SosSpacing
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
    SosCard(
        modifier = modifier.testTag("platform_self_repair_card"),
        highlighted = true,
        accent = SosIosColors.WarningOrange,
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(SosSpacing.sm), verticalAlignment = Alignment.Top) {
            Icon(
                imageVector = Icons.Filled.Warning,
                contentDescription = null,
                tint = SosIosColors.WarningOrange,
            )
            Column(verticalArrangement = Arrangement.spacedBy(SosSpacing.xs)) {
                Text(text = stringResource(R.string.platform_self_repair_title), style = MaterialTheme.typography.titleSmall)
                Text(text = message, style = MaterialTheme.typography.bodyMedium)
            }
        }
        if (hint == PlatformUserHint.FIX_PERMISSIONS || hint == PlatformUserHint.FIX_BLUETOOTH) {
            SosSecondaryButton(
                text = stringResource(R.string.platform_self_repair_action),
                onClick = onOpenPermissions,
            )
        }
    }
}

@Composable
fun RelayEducationCard(
    onOpenRelay: () -> Unit,
    modifier: Modifier = Modifier,
) {
    SosIconCard(
        icon = Icons.Filled.Sensors,
        modifier = modifier.testTag("relay_education_card"),
    ) {
        Text(stringResource(R.string.relay_education_title), style = MaterialTheme.typography.titleMedium)
        Text(
            stringResource(R.string.relay_education_body),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            stringResource(com.sosmesh.android.core.permissions.R.string.background_no_guarantee),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        SosPrimaryButton(
            text = stringResource(R.string.relay_education_cta),
            onClick = onOpenRelay,
            modifier = Modifier.padding(top = SosSpacing.xs),
        )
    }
}

package com.sosmesh.android.feature.sos.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.sosmesh.android.core.data.sos.DraftInvalidReason
import com.sosmesh.android.core.data.sos.LocationFreshness
import com.sosmesh.android.core.data.sos.LocationFreshnessTier
import com.sosmesh.android.core.data.sos.LocationSnapshot
import com.sosmesh.android.core.model.SosType
import com.sosmesh.android.feature.sos.R
import com.sosmesh.android.feature.sos.SosFormUiState
import com.sosmesh.android.feature.sos.SosWizardStep

@Composable
fun SosFlowScreen(
    state: SosFormUiState,
    onSelectType: (SosType) -> Unit,
    onPersonCountChange: (String) -> Unit,
    onPersonUnknownChange: (Boolean) -> Unit,
    onNoteChange: (String) -> Unit,
    onManualToggle: (Boolean) -> Unit,
    onManualLat: (String) -> Unit,
    onManualLng: (String) -> Unit,
    onContinue: () -> Unit,
    onBackFromPreview: () -> Unit,
    onConfirm: () -> Unit,
    modifier: Modifier = Modifier,
) {
    when (state.step) {
        SosWizardStep.FORM ->
            SosFormScreen(
                state = state,
                onSelectType = onSelectType,
                onPersonCountChange = onPersonCountChange,
                onPersonUnknownChange = onPersonUnknownChange,
                onNoteChange = onNoteChange,
                onManualToggle = onManualToggle,
                onManualLat = onManualLat,
                onManualLng = onManualLng,
                onContinue = onContinue,
                modifier = modifier,
            )
        SosWizardStep.PREVIEW ->
            SosPreviewScreen(
                state = state,
                onBack = onBackFromPreview,
                onConfirm = onConfirm,
                modifier = modifier,
            )
        SosWizardStep.DONE ->
            SosDoneScreen(modifier = modifier)
    }
}

@Composable
private fun SosFormScreen(
    state: SosFormUiState,
    onSelectType: (SosType) -> Unit,
    onPersonCountChange: (String) -> Unit,
    onPersonUnknownChange: (Boolean) -> Unit,
    onNoteChange: (String) -> Unit,
    onManualToggle: (Boolean) -> Unit,
    onManualLat: (String) -> Unit,
    onManualLng: (String) -> Unit,
    onContinue: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        OfflineBadge()
        Text(text = stringResource(R.string.sos_not112_disclaimer), style = MaterialTheme.typography.bodySmall)
        Text(text = stringResource(R.string.sos_flow_title), style = MaterialTheme.typography.headlineSmall)
        Text(text = stringResource(R.string.sos_secondary_continue_hint), style = MaterialTheme.typography.bodySmall)
        Text(text = stringResource(R.string.sos_type_label), style = MaterialTheme.typography.titleMedium)
        Row(
            modifier = Modifier.selectableGroup(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            for (type in SosType.entries) {
                val labelText = typeLabel(type)
                FilterChip(
                    selected = state.selectedType == type,
                    onClick = { onSelectType(type) },
                    label = { Text(labelText) },
                    modifier =
                        Modifier.semantics {
                            contentDescription = labelText
                            role = Role.RadioButton
                        },
                )
            }
        }
        Text(text = stringResource(R.string.sos_person_count_label))
        if (!state.personCountUnknown) {
            OutlinedTextField(
                value = state.personCountText,
                onValueChange = onPersonCountChange,
                modifier = Modifier.fillMaxWidth().testTag("sos_person_count"),
                singleLine = true,
            )
        }
        Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
            Checkbox(checked = state.personCountUnknown, onCheckedChange = onPersonUnknownChange)
            Text(stringResource(R.string.sos_person_unknown))
        }
        validationText(state.validationError)?.let {
            Text(text = it, color = MaterialTheme.colorScheme.error)
        }
        OutlinedTextField(
            value = state.note,
            onValueChange = onNoteChange,
            label = { Text(stringResource(R.string.sos_note_label)) },
            placeholder = { Text(stringResource(R.string.sos_note_hint)) },
            modifier = Modifier.fillMaxWidth().testTag("sos_note"),
        )
        LocationSection(
            location = state.gpsLocation,
            useManual = state.useManualLocation,
            manualLat = state.manualLat,
            manualLng = state.manualLng,
            onManualToggle = onManualToggle,
            onManualLat = onManualLat,
            onManualLng = onManualLng,
        )
        Button(
            onClick = onContinue,
            enabled = state.canContinue,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .defaultMinSize(minHeight = 48.dp)
                    .testTag("sos_continue_button"),
        ) {
            Text(stringResource(R.string.sos_continue))
        }
    }
}

@Composable
private fun SosPreviewScreen(
    state: SosFormUiState,
    onBack: () -> Unit,
    onConfirm: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(stringResource(R.string.sos_preview_title), style = MaterialTheme.typography.headlineSmall)
        Text(stringResource(R.string.sos_type_label) + ": " + typeLabel(state.selectedType))
        Text(
            stringResource(R.string.sos_person_count_label) + ": " +
                if (state.personCountUnknown) {
                    stringResource(R.string.sos_person_unknown)
                } else {
                    state.personCountText
                },
        )
        if (state.note.isNotBlank()) {
            Text(stringResource(R.string.sos_note_label) + ": " + state.note)
        }
        LocationPreview(state)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = onBack, modifier = Modifier.defaultMinSize(minHeight = 48.dp)) {
                Text(stringResource(R.string.sos_preview_back))
            }
            Button(
                onClick = onConfirm,
                modifier =
                    Modifier
                        .weight(1f)
                        .defaultMinSize(minHeight = 48.dp)
                        .testTag("sos_confirm_button"),
            ) {
                Text(stringResource(R.string.sos_preview_confirm))
            }
        }
    }
}

@Composable
private fun SosDoneScreen(modifier: Modifier = Modifier) {
    Column(modifier = modifier.fillMaxSize().padding(24.dp)) {
        Text(stringResource(R.string.sos_saved_local), style = MaterialTheme.typography.titleLarge)
    }
}

@Composable
private fun OfflineBadge() {
    Surface(color = MaterialTheme.colorScheme.errorContainer) {
        Text(
            text = stringResource(R.string.sos_offline_badge),
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            style = MaterialTheme.typography.labelLarge,
        )
    }
}

@Composable
private fun LocationFreshnessBadge(location: LocationSnapshot) {
    val tier =
        LocationFreshness.tier(
            capturedAtMs = location.capturedAtMs,
            nowMs = System.currentTimeMillis(),
        )
    val label =
        when (tier) {
            LocationFreshnessTier.FRESH -> stringResource(R.string.sos_location_fresh)
            LocationFreshnessTier.AGING -> stringResource(R.string.sos_location_aging)
            LocationFreshnessTier.STALE -> stringResource(R.string.sos_location_stale)
            LocationFreshnessTier.UNKNOWN -> stringResource(R.string.sos_location_unknown)
        }
    Surface(
        color =
            when (tier) {
                LocationFreshnessTier.STALE -> MaterialTheme.colorScheme.errorContainer
                LocationFreshnessTier.AGING -> MaterialTheme.colorScheme.secondaryContainer
                else -> MaterialTheme.colorScheme.surfaceVariant
            },
        modifier = Modifier.testTag("sos_location_freshness"),
    ) {
        Text(text = label, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
    }
}

@Composable
private fun LocationSection(
    location: LocationSnapshot,
    useManual: Boolean,
    manualLat: String,
    manualLng: String,
    onManualToggle: (Boolean) -> Unit,
    onManualLat: (String) -> Unit,
    onManualLng: (String) -> Unit,
) {
    Text(stringResource(R.string.sos_location_label), style = MaterialTheme.typography.titleMedium)
    if (!useManual && location.isKnown) {
        LocationFreshnessBadge(location = location)
    }
    if (!location.isKnown && !useManual) {
        Text(
            stringResource(R.string.sos_location_unknown),
            modifier = Modifier.testTag("sos_location_unknown"),
        )
    } else if (!useManual) {
        Text("${location.latitude}, ${location.longitude}")
        location.accuracyMeters?.let {
            Text(stringResource(R.string.sos_location_accuracy, it))
        }
    }
    Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
        Checkbox(checked = useManual, onCheckedChange = onManualToggle)
        Text(stringResource(R.string.sos_manual_location))
    }
    if (useManual) {
        OutlinedTextField(
            value = manualLat,
            onValueChange = onManualLat,
            label = { Text(stringResource(R.string.sos_manual_lat)) },
            modifier = Modifier.fillMaxWidth().testTag("sos_manual_lat"),
        )
        OutlinedTextField(
            value = manualLng,
            onValueChange = onManualLng,
            label = { Text(stringResource(R.string.sos_manual_lng)) },
            modifier = Modifier.fillMaxWidth().testTag("sos_manual_lng"),
        )
    }
}

@Composable
private fun LocationPreview(state: SosFormUiState) {
    val loc =
        if (state.useManualLocation) {
            val lat = state.manualLat.trim().toDoubleOrNull()
            val lng = state.manualLng.trim().toDoubleOrNull()
            if (lat != null && lng != null) {
                LocationSnapshot.manual(lat, lng)
            } else {
                LocationSnapshot.unknown()
            }
        } else {
            state.gpsLocation
        }
    if (!loc.isKnown) {
        Text(stringResource(R.string.sos_location_unknown))
    } else {
        Text("${loc.latitude}, ${loc.longitude}")
    }
}

@Composable
private fun typeLabel(type: SosType): String =
    when (type) {
        SosType.DEPREM -> stringResource(R.string.sos_type_deprem)
        SosType.YANGIN -> stringResource(R.string.sos_type_yangin)
        SosType.SEL -> stringResource(R.string.sos_type_sel)
        SosType.YARALANMA -> stringResource(R.string.sos_type_yaralanma)
        SosType.DIGER -> stringResource(R.string.sos_type_diger)
    }

@Composable
private fun validationText(reason: DraftInvalidReason?): String? =
    when (reason) {
        DraftInvalidReason.PERSON_COUNT_TOO_LOW -> stringResource(R.string.sos_error_person_low)
        DraftInvalidReason.PERSON_COUNT_TOO_HIGH -> stringResource(R.string.sos_error_person_high)
        DraftInvalidReason.NOTE_TOO_LONG -> stringResource(R.string.sos_error_note_long)
        null -> null
    }

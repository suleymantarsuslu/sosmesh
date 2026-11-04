package com.sosmesh.android.ui.profile

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.hilt.navigation.compose.hiltViewModel
import com.sosmesh.android.R
import com.sosmesh.android.core.design.components.SosCall112Button
import com.sosmesh.android.core.design.components.SosScreenScaffold
import com.sosmesh.android.core.design.components.SosScrollableScreenContent

/** Optional profile (mesh-v2 §7). Every field optional; Skip and SOS always reachable; 112 visible. */
@Composable
fun ProfileRoute(
    onDone: () -> Unit,
    onOpenSos: () -> Unit,
    viewModel: ProfileViewModel = hiltViewModel(),
) {
    val f by viewModel.form.collectAsState()
    SosScreenScaffold(
        title = stringResource(R.string.profile_title),
        onNavigateBack = { viewModel.skip(onDone) },
    ) { contentModifier ->
        SosScrollableScreenContent(contentModifier) {
            SosCall112Button()
            Button(onClick = onOpenSos, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.profile_open_sos)) }
            Text(stringResource(R.string.profile_intro), style = MaterialTheme.typography.bodyMedium)
            Field(R.string.profile_full_name, f.fullName) { v -> viewModel.update { it.copy(fullName = v) } }
            Field(R.string.profile_age, f.age, KeyboardType.Number) { v -> viewModel.update { it.copy(age = v) } }
            Field(R.string.profile_address_line, f.addressLine) { v -> viewModel.update { it.copy(addressLine = v) } }
            Field(R.string.profile_district, f.district) { v -> viewModel.update { it.copy(district = v) } }
            Field(R.string.profile_city, f.city) { v -> viewModel.update { it.copy(city = v) } }
            Field(R.string.profile_postal_code, f.postalCode) { v -> viewModel.update { it.copy(postalCode = v) } }
            Field(R.string.profile_country, f.country) { v -> viewModel.update { it.copy(country = v) } }
            Field(R.string.profile_floor, f.floor, KeyboardType.Number) { v -> viewModel.update { it.copy(floor = v) } }
            Field(R.string.profile_phone, f.phone, KeyboardType.Phone) { v -> viewModel.update { it.copy(phone = v) } }
            Field(R.string.profile_email, f.email, KeyboardType.Email) { v -> viewModel.update { it.copy(email = v) } }
            Field(R.string.profile_household_size, f.householdSize, KeyboardType.Number) { v ->
                viewModel.update { it.copy(householdSize = v) }
            }
            Text(
                stringResource(if (f.homeLat != null) R.string.profile_location_set else R.string.profile_location_hint),
                style = MaterialTheme.typography.bodySmall,
            )
            if (f.geocodeFailed) {
                Text(stringResource(R.string.profile_geocode_failed), style = MaterialTheme.typography.bodySmall)
            }
            Text(stringResource(R.string.profile_privacy_note), style = MaterialTheme.typography.bodySmall)
            Button(onClick = { viewModel.save(onDone) }, enabled = !f.saving, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.profile_save))
            }
            OutlinedButton(onClick = { viewModel.skip(onDone) }, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.profile_skip))
            }
            TextButton(onClick = { viewModel.delete {} }, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.profile_delete))
            }
        }
    }
}

@Composable
private fun Field(
    label: Int,
    value: String,
    keyboard: KeyboardType = KeyboardType.Text,
    onChange: (String) -> Unit,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(stringResource(label)) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = keyboard),
        modifier = Modifier.fillMaxWidth(),
    )
}

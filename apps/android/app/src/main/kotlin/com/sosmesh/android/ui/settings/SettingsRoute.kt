package com.sosmesh.android.ui.settings

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.PersonSearch
import androidx.compose.material.icons.filled.Security
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.sosmesh.android.R
import com.sosmesh.android.core.design.components.SosCall112Button
import com.sosmesh.android.core.design.components.SosCard
import com.sosmesh.android.core.design.components.SosLanguagePicker
import com.sosmesh.android.core.design.components.SosNot112Banner
import com.sosmesh.android.core.design.components.SosScreenScaffold
import com.sosmesh.android.core.design.components.SosScrollableScreenContent
import com.sosmesh.android.core.design.components.SosSectionHeader
import com.sosmesh.android.core.design.components.SosToggleRow
import com.sosmesh.android.core.design.theme.SosIosColors
import com.sosmesh.android.core.design.theme.SosSpacing
import com.sosmesh.android.locale.AppLocaleController

@Composable
fun SettingsRoute(
    onHighContrastChanged: () -> Unit,
    onOpenProfile: () -> Unit = {},
    onOpenPermissions: () -> Unit = {},
    viewModel: SettingsViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()
    val context = androidx.compose.ui.platform.LocalContext.current
    val languageTag = AppLocaleController.readStoredTag(context)
    SosScreenScaffold(
        title = stringResource(R.string.settings_title),
        showLogoInTopBar = false,
    ) { contentModifier ->
        SosScrollableScreenContent(contentModifier) {
            SosSectionHeader(stringResource(R.string.settings_section_profile))
            NavigationCard(
                label = stringResource(R.string.settings_profile),
                icon = Icons.Filled.PersonSearch,
                onClick = onOpenProfile,
                testTag = "settings_profile_row",
            )
            SosSectionHeader(stringResource(com.sosmesh.android.core.design.R.string.design_language_label))
            SosCard {
                SosLanguagePicker(
                    selectedLanguageTag = languageTag,
                    onLanguageSelected = { tag ->
                        AppLocaleController.setApplicationLanguage(context.applicationContext, tag)
                    },
                )
            }
            SosSectionHeader(stringResource(R.string.settings_section_permissions))
            NavigationCard(
                label = stringResource(R.string.settings_permissions_cta),
                icon = Icons.Filled.Security,
                onClick = onOpenPermissions,
                testTag = "settings_permissions_row",
            )
            SosSectionHeader(stringResource(R.string.settings_section_display))
            SosCard {
                SosToggleRow(
                    title = stringResource(R.string.settings_high_contrast),
                    checked = state.highContrast,
                    onCheckedChange = {
                        viewModel.setHighContrast(it)
                        onHighContrastChanged()
                    },
                )
            }
            SosSectionHeader(stringResource(R.string.settings_section_radio))
            SosCard {
                SosToggleRow(
                    title = stringResource(R.string.settings_high_power_radio_consent),
                    description = stringResource(R.string.settings_high_power_radio_intro),
                    checked = state.highPowerRadioConsent,
                    onCheckedChange = viewModel::setHighPowerRadioConsent,
                )
            }
            SosSectionHeader(stringResource(R.string.settings_section_data))
            SosCard {
                Text(stringResource(R.string.settings_data_control_intro), style = MaterialTheme.typography.bodyMedium)
                Text(
                    stringResource(R.string.settings_local_data_note),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            SosNot112Banner(
                disclaimerText = stringResource(com.sosmesh.android.core.permissions.R.string.permission_disclaimer_not112),
            )
            SosCall112Button(testTag = "settings_call_112_button")
        }
    }
}

@Composable
private fun NavigationCard(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit,
    testTag: String,
) {
    SosCard(
        modifier =
            Modifier
                .testTag(testTag)
                .clickable(role = Role.Button, onClick = onClick),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 32.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(SosSpacing.sm),
        ) {
            Icon(imageVector = icon, contentDescription = null, tint = SosIosColors.AccentBlueText)
            Text(
                text = label,
                style = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.weight(1f),
            )
            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = null,
                tint = SosIosColors.LabelTertiary,
            )
        }
    }
}

package com.sosmesh.android.core.design.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import com.sosmesh.android.core.design.R
import com.sosmesh.android.core.design.theme.SosSpacing

@Composable
fun SosLanguagePicker(
    selectedLanguageTag: String,
    onLanguageSelected: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.testTag("language_picker"),
        verticalArrangement = Arrangement.spacedBy(SosSpacing.xs),
    ) {
        Text(
            text = stringResource(R.string.design_language_label),
            style = MaterialTheme.typography.titleSmall,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(SosSpacing.xs)) {
            FilterChip(
                selected = selectedLanguageTag == "en",
                onClick = { onLanguageSelected("en") },
                label = { Text(stringResource(R.string.design_language_english)) },
                modifier = Modifier.testTag("language_option_en"),
            )
            FilterChip(
                selected = selectedLanguageTag == "tr",
                onClick = { onLanguageSelected("tr") },
                label = { Text(stringResource(R.string.design_language_turkish)) },
                modifier = Modifier.testTag("language_option_tr"),
            )
        }
    }
}

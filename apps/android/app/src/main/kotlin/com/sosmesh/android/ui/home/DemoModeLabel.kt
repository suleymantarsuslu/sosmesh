package com.sosmesh.android.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.sosmesh.android.R

@Composable
fun DemoModeLabel(visible: Boolean) {
    if (!visible) {
        return
    }
    Text(
        text = stringResource(R.string.demo_mode_banner),
        modifier =
            Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.errorContainer)
                .padding(horizontal = 16.dp, vertical = 8.dp)
                .testTag("demo-mode-label"),
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.onErrorContainer,
    )
}

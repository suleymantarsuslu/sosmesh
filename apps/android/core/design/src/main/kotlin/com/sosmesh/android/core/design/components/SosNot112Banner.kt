package com.sosmesh.android.core.design.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import com.sosmesh.android.core.design.theme.SosShapes
import com.sosmesh.android.core.design.theme.SosSpacing

@Composable
fun SosNot112Banner(
    disclaimerText: String,
    modifier: Modifier = Modifier,
    showCall112: Boolean = true,
) {
    Surface(
        modifier = modifier.fillMaxWidth().testTag("sos_not112_banner"),
        color = MaterialTheme.colorScheme.errorContainer,
        contentColor = MaterialTheme.colorScheme.onErrorContainer,
        shape = SosShapes.banner,
    ) {
        Column(
            modifier = Modifier.padding(SosSpacing.sm),
            verticalArrangement = Arrangement.spacedBy(SosSpacing.xs),
        ) {
            Text(text = disclaimerText, style = MaterialTheme.typography.bodyMedium)
            if (showCall112) {
                SosCall112Button(outlined = false)
            }
        }
    }
}

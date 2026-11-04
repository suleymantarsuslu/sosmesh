package com.sosmesh.android.core.design.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.sosmesh.android.core.design.theme.SosIosColors
import com.sosmesh.android.core.design.theme.SosSpacing

/** "SOSMesh does not replace 112" disclaimer card with the iOS info glyph. The call button is separate. */
@Composable
fun SosNot112Banner(
    disclaimerText: String,
    modifier: Modifier = Modifier,
    showCall112: Boolean = false,
) {
    SosCard(modifier = modifier.testTag("sos_not112_banner")) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(SosSpacing.sm),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = Icons.Filled.Info,
                contentDescription = null,
                tint = SosIosColors.AccentBlueText,
                modifier = Modifier.size(24.dp),
            )
            Text(text = disclaimerText, style = MaterialTheme.typography.bodyMedium)
        }
        if (showCall112) {
            SosCall112Button()
        }
    }
}

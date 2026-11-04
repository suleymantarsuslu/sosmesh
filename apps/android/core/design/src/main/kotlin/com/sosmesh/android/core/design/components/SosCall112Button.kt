package com.sosmesh.android.core.design.components

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.sosmesh.android.core.design.R
import com.sosmesh.android.core.design.theme.SosIosColors
import com.sosmesh.android.core.design.theme.SosShapes
import com.sosmesh.android.core.design.theme.SosSpacing

/** Always-visible emergency call: filled accent-blue button with a phone glyph, same as the iOS app. */
@Composable
fun SosCall112Button(
    modifier: Modifier = Modifier,
    testTag: String = "sos_call_112_button",
) {
    val context = LocalContext.current
    val label = stringResource(R.string.design_call_112_button)
    val cd = stringResource(R.string.design_call_112_content_description)
    Button(
        onClick = {
            try {
                context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:112")))
            } catch (_: ActivityNotFoundException) {
                // No dialer installed; nothing else to do.
            }
        },
        shape = SosShapes.button,
        contentPadding = PaddingValues(horizontal = SosSpacing.md, vertical = SosSpacing.sm),
        colors =
            ButtonDefaults.buttonColors(
                containerColor = SosIosColors.AccentBlue,
                contentColor = Color.White,
            ),
        modifier =
            modifier
                .fillMaxWidth()
                .defaultMinSize(minHeight = SosSpacing.touchMin)
                .testTag(testTag)
                .semantics {
                    contentDescription = cd
                    role = Role.Button
                },
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(SosSpacing.xs)) {
            Icon(imageVector = Icons.Filled.Phone, contentDescription = null, modifier = Modifier.size(20.dp))
            Text(label, style = MaterialTheme.typography.titleMedium)
        }
    }
}

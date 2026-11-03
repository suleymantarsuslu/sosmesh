package com.sosmesh.android.core.design.components

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import com.sosmesh.android.core.design.R
import com.sosmesh.android.core.design.theme.SosShapes
import com.sosmesh.android.core.design.theme.SosSpacing

@Composable
fun SosCall112Button(
    modifier: Modifier = Modifier,
    outlined: Boolean = true,
) {
    val context = LocalContext.current
    val label = stringResource(R.string.design_call_112_button)
    val cd = stringResource(R.string.design_call_112_content_description)
    val onClick = {
        context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:112")))
    }
    val buttonModifier =
        modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = SosSpacing.touchMin)
            .testTag("sos_call_112_button")
            .semantics {
                contentDescription = cd
                role = Role.Button
            }
    if (outlined) {
        OutlinedButton(onClick = onClick, modifier = buttonModifier, shape = SosShapes.button) {
            Text(label, style = MaterialTheme.typography.titleMedium)
        }
    } else {
        Button(
            onClick = onClick,
            modifier = buttonModifier,
            shape = SosShapes.button,
            colors =
                ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.secondaryContainer,
                    contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
                ),
        ) {
            Text(label, style = MaterialTheme.typography.titleMedium)
        }
    }
}

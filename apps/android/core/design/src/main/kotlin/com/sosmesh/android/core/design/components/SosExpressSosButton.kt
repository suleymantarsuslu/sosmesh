package com.sosmesh.android.core.design.components

import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import com.sosmesh.android.core.design.theme.SosBrandColors
import com.sosmesh.android.core.design.theme.SosShapes
import com.sosmesh.android.core.design.theme.SosSpacing

@Composable
fun SosExpressSosButton(
    label: String,
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    testTag: String = "home_express_sos_button",
) {
    Button(
        onClick = onClick,
        modifier =
            modifier
                .fillMaxWidth()
                .height(SosSpacing.sosButtonHeight)
                .defaultMinSize(minHeight = SosSpacing.touchMin)
                .testTag(testTag)
                .semantics {
                    this.contentDescription = contentDescription
                    role = Role.Button
                },
        shape = SosShapes.button,
        colors =
            ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
        elevation =
            ButtonDefaults.buttonElevation(
                defaultElevation = SosSpacing.xxs,
                pressedElevation = SosSpacing.xs,
            ),
    ) {
        Text(label, style = MaterialTheme.typography.headlineMedium)
    }
}

@Composable
fun SosExpressSosButtonHighContrast(
    label: String,
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    testTag: String = "home_express_sos_button",
) {
    Button(
        onClick = onClick,
        modifier =
            modifier
                .fillMaxWidth()
                .height(SosSpacing.sosButtonHeight)
                .defaultMinSize(minHeight = SosSpacing.touchMin)
                .testTag(testTag)
                .semantics {
                    this.contentDescription = contentDescription
                    role = Role.Button
                },
        shape = SosShapes.button,
        colors =
            ButtonDefaults.buttonColors(
                containerColor = SosBrandColors.SosRedBright,
                contentColor = SosBrandColors.OnSosRed,
            ),
    ) {
        Text(label, style = MaterialTheme.typography.headlineMedium)
    }
}

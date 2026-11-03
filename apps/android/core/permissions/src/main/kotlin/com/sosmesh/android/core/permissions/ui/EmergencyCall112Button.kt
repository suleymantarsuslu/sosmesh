package com.sosmesh.android.core.permissions.ui

import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import com.sosmesh.android.core.permissions.EmergencyDialIntents
import com.sosmesh.android.core.permissions.R

@Composable
fun EmergencyCall112Button(
    modifier: Modifier = Modifier,
    testTag: String = "persistent_call_112_button",
) {
    val context = LocalContext.current
    val label = stringResource(R.string.permission_call_112_button)
    Button(
        onClick = { context.startActivity(EmergencyDialIntents.dial112(context)) },
        modifier = modifier.testTag(testTag),
    ) {
        Text(label)
    }
}

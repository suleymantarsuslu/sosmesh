package com.sosmesh.android.core.permissions.ui

import android.content.ActivityNotFoundException
import android.util.Log
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
    val emergencyNumber = com.sosmesh.android.core.design.emergency.EmergencyNumberProvider.getEmergencyNumber(context)
    val label = stringResource(R.string.permission_call_112_button, emergencyNumber)
    Button(
        onClick = {
            try {
                context.startActivity(EmergencyDialIntents.dial112(context))
            } catch (_: ActivityNotFoundException) {
                Log.w("EmergencyCall112Button", "dial_112_activity_not_found")
            }
        },
        modifier = modifier.testTag(testTag),
    ) {
        Text(label)
    }
}

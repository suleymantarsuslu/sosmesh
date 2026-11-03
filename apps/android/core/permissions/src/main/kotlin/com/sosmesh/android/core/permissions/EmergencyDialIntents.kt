package com.sosmesh.android.core.permissions

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings

object EmergencyDialIntents {
    fun dial112(context: Context): Intent =
        Intent(Intent.ACTION_DIAL, Uri.parse("tel:112"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
}

object LocationSettingsIntents {
    fun locationSourceSettings(): Intent =
        Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
}

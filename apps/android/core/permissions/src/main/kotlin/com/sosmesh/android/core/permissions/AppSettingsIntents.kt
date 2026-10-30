package com.sosmesh.android.core.permissions

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings

object AppSettingsIntents {
    fun applicationDetails(context: Context): Intent =
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.fromParts("package", context.packageName, null)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
}

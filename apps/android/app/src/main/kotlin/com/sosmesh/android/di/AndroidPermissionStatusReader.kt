package com.sosmesh.android.di

import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import com.sosmesh.android.core.permissions.PermissionStatusReader
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AndroidPermissionStatusReader
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) : PermissionStatusReader {
        override fun isGranted(permission: String): Boolean =
            ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

        override fun shouldShowRationale(permission: String): Boolean {
            val activity = context as? android.app.Activity
            return activity?.shouldShowRequestPermissionRationale(permission) ?: false
        }
    }

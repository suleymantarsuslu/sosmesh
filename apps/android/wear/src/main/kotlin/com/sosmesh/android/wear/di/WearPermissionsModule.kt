package com.sosmesh.android.wear.di

import android.content.Context
import android.os.Build
import com.sosmesh.android.core.permissions.PermissionFlowCoordinator
import com.sosmesh.android.core.permissions.PermissionStatusReader
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object WearPermissionsModule {
    @Provides
    @Singleton
    fun providePermissionStatusReader(
        @ApplicationContext context: Context,
    ): PermissionStatusReader =
        object : PermissionStatusReader {
            override fun isGranted(permission: String): Boolean =
                androidx.core.content.ContextCompat.checkSelfPermission(
                    context,
                    permission,
                ) == android.content.pm.PackageManager.PERMISSION_GRANTED

            override fun shouldShowRationale(permission: String): Boolean = false
        }

    @Provides
    @Singleton
    fun providePermissionFlowCoordinator(
        statusReader: PermissionStatusReader,
    ): PermissionFlowCoordinator =
        PermissionFlowCoordinator(
            sdkInt = Build.VERSION.SDK_INT,
            statusReader = statusReader,
        )
}

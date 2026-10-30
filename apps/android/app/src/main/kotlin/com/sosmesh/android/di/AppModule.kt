package com.sosmesh.android.di

import android.content.Context
import android.os.Build
import com.sosmesh.android.core.ble.BleMeshRadio
import com.sosmesh.android.core.ble.BleMeshRadioSkeleton
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
object AppModule {
    @Provides
    @Singleton
    fun providePermissionStatusReader(
        @ApplicationContext context: Context,
    ): PermissionStatusReader = AndroidPermissionStatusReader(context)

    @Provides
    @Singleton
    fun providePermissionFlowCoordinator(reader: PermissionStatusReader): PermissionFlowCoordinator =
        PermissionFlowCoordinator(
            sdkInt = Build.VERSION.SDK_INT,
            statusReader = reader,
        )

    @Provides
    @Singleton
    fun provideBleMeshRadio(skeleton: BleMeshRadioSkeleton): BleMeshRadio = skeleton
}

package com.sosmesh.android.feature.sos.di

import com.sosmesh.android.core.data.attachment.AttachmentUploadScheduler
import com.sosmesh.android.feature.sos.attachment.SosAttachmentUploadScheduler
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class SosAttachmentModule {
    @Binds
    @Singleton
    abstract fun bindAttachmentUploadScheduler(impl: SosAttachmentUploadScheduler): AttachmentUploadScheduler
}

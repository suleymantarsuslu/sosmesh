package com.sosmesh.android.feature.sos.attachment

import android.content.Context
import androidx.startup.Initializer
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent

class AttachmentUploadInitializer : Initializer<Unit> {
    override fun create(context: Context) {
        val entryPoint =
            EntryPointAccessors.fromApplication(
                context.applicationContext,
                AttachmentUploadInitializerEntryPoint::class.java,
            )
        entryPoint.attachmentUploadScheduler().retryPendingUploads()
    }

    override fun dependencies(): List<Class<out Initializer<*>>> {
        return emptyList()
    }

    @EntryPoint
    @InstallIn(SingletonComponent::class)
    interface AttachmentUploadInitializerEntryPoint {
        fun attachmentUploadScheduler(): SosAttachmentUploadScheduler
    }
}

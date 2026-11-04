package com.sosmesh.android.core.data.broadcast

import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions

object FirebaseInitializer {
    fun initialize(
        context: Context,
        projectId: String?,
        applicationId: String?,
        apiKey: String?,
    ) {
        if (projectId.isNullOrBlank() || applicationId.isNullOrBlank() || apiKey.isNullOrBlank()) {
            return
        }

        if (FirebaseApp.getApps(context).isNotEmpty()) {
            return
        }

        try {
            val options =
                FirebaseOptions.Builder()
                    .setProjectId(projectId)
                    .setApplicationId(applicationId)
                    .setApiKey(apiKey)
                    .build()

            FirebaseApp.initializeApp(context, options)
        } catch (e: Exception) {
            // Silently fail if Firebase cannot be initialized
        }
    }
}

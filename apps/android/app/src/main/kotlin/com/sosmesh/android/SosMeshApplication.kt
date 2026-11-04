package com.sosmesh.android

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import com.sosmesh.android.crash.LocalCrashReporter
import com.sosmesh.android.locale.AppLocaleController
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class SosMeshApplication : Application(), Configuration.Provider {
    @Inject
    lateinit var workerFactory: HiltWorkerFactory

    @Inject
    lateinit var crashReporter: LocalCrashReporter

    @Inject
    lateinit var meshV2Runtime: com.sosmesh.android.meshv2.v2.MeshV2Runtime

    override fun onCreate() {
        super.onCreate()
        AppLocaleController.applyStoredLocale(this)
        crashReporter.install()
        meshV2Runtime.install()
    }

    override val workManagerConfiguration: Configuration
        get() =
            Configuration.Builder()
                .setWorkerFactory(workerFactory)
                .build()
}

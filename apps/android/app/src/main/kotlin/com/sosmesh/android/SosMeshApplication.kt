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

    override fun onCreate() {
        super.onCreate()
        AppLocaleController.applyStoredLocale(this)
        crashReporter.install()
    }

    override val workManagerConfiguration: Configuration
        get() =
            Configuration.Builder()
                .setWorkerFactory(workerFactory)
                .build()
}

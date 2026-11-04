package com.sosmesh.android.wear

import android.app.Application
import com.sosmesh.android.meshv2.v2.MeshV2Runtime
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class WearApplication : Application() {
    @Inject
    lateinit var meshV2Runtime: MeshV2Runtime

    override fun onCreate() {
        super.onCreate()
        meshV2Runtime.install(filesDir)
    }
}

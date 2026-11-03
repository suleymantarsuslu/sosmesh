package com.sosmesh.android.feature.sos.notification

import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AppVisibilityTracker
    @Inject
    constructor() : DefaultLifecycleObserver {
        @Volatile
        private var isInForeground = false

        init {
            ProcessLifecycleOwner.get().lifecycle.addObserver(this)
        }

        override fun onStart(owner: LifecycleOwner) {
            isInForeground = true
        }

        override fun onStop(owner: LifecycleOwner) {
            isInForeground = false
        }

        fun isAppInForeground(): Boolean = isInForeground
    }

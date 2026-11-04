package com.sosmesh.android.feature.sos.notification

import android.os.Handler
import android.os.Looper
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Tracks whether the app process is in the foreground.
 *
 * This singleton can be created first on a WorkManager background thread (a Hilt worker
 * factory injects it), while Lifecycle.addObserver must run on the main thread. Registration is
 * therefore posted to the main looper when the constructor runs off the main thread.
 */
@Singleton
class AppVisibilityTracker
    @Inject
    constructor() : DefaultLifecycleObserver {
        @Volatile
        private var isInForeground = false

        init {
            if (Looper.myLooper() == Looper.getMainLooper()) {
                register()
            } else {
                Handler(Looper.getMainLooper()).post { register() }
            }
        }

        private fun register() {
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

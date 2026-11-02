package com.sosmesh.android.crash

interface LocalCrashReporter {
    fun install()

    fun recordHandled(
        tag: String,
        throwable: Throwable,
    )
}

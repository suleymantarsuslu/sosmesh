package com.sosmesh.android.crash

import android.content.Context
import com.sosmesh.android.BuildConfig
import dagger.hilt.android.qualifiers.ApplicationContext
import org.json.JSONObject
import java.io.File
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Writes crash reports to app-private storage only (no third-party crash SDK).
 */
@Singleton
class RedactedLocalCrashReporter
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) : LocalCrashReporter {
        private val priorHandler = Thread.getDefaultUncaughtExceptionHandler()

        override fun install() {
            Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
                persist("uncaught", thread.name, throwable)
                priorHandler?.uncaughtException(thread, throwable)
            }
        }

        override fun recordHandled(
            tag: String,
            throwable: Throwable,
        ) {
            persist("handled", tag, throwable)
        }

        private fun persist(
            kind: String,
            source: String,
            throwable: Throwable,
        ) {
            val dir = File(context.filesDir, "sosmesh-crash")
            if (!dir.exists()) {
                dir.mkdirs()
            }
            val payload =
                JSONObject()
                    .put("kind", kind)
                    .put("source", CrashLogRedactor.redact(source))
                    .put("env", BuildConfig.SOSMESH_ENV)
                    .put("versionName", BuildConfig.VERSION_NAME)
                    .put("versionCode", BuildConfig.VERSION_CODE)
                    .put("timestamp", Instant.now().toString())
                    .put("exception", CrashLogRedactor.redact(throwable.javaClass.name))
                    .put("message", CrashLogRedactor.redact(throwable.message ?: ""))
                    .put(
                        "stack",
                        CrashLogRedactor.redact(
                            throwable.stackTraceToString().take(MAX_STACK_CHARS),
                        ),
                    )
            val file = File(dir, "crash-${System.currentTimeMillis()}.json")
            file.writeText(payload.toString())
        }

        companion object {
            private const val MAX_STACK_CHARS = 16_384
        }
    }

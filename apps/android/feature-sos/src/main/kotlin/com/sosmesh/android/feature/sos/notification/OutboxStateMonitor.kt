package com.sosmesh.android.feature.sos.notification

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import com.sosmesh.android.core.data.outbox.RelayOutboxReader
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class OutboxStateMonitor
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
        private val outboxReader: RelayOutboxReader,
        private val notificationManager: SosDeliveryNotificationManager,
    ) {
        private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        private val seenServerAccepted = mutableSetOf<String>()

        fun start() {
            scope.launch {
                while (true) {
                    try {
                        checkForServerAcceptedMessages()
                    } catch (e: Exception) {
                    }
                    delay(5000L)
                }
            }
        }

        private suspend fun checkForServerAcceptedMessages() {
            if (isAppInForeground()) return

            val entries = outboxReader.listAll()
            entries
                .filter { it.state == "SERVER_ACCEPTED" && it.origin == "android" }
                .forEach { entry ->
                    val key = "${entry.sosId}_${entry.digest}"
                    if (!seenServerAccepted.contains(key)) {
                        seenServerAccepted.add(key)
                        notificationManager.notifyServerAccepted(entry.sosId)
                    }
                }
        }

        private fun isAppInForeground(): Boolean {
            val activityManager =
                context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val processInfo =
                    activityManager.runningAppProcesses?.firstOrNull {
                        it.pid == android.os.Process.myPid()
                    }
                return processInfo?.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
            }
            return true
        }
    }

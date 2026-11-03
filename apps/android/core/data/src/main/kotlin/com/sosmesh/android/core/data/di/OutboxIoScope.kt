package com.sosmesh.android.core.data.di

import android.util.Log
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/** Fire-and-forget outbox / BLE side effects off the UI thread. */
@Singleton
class OutboxIoScope
    @Inject
    constructor(
        @IoDispatcher ioDispatcher: CoroutineDispatcher,
    ) {
        private val scope =
            CoroutineScope(
                SupervisorJob() +
                    ioDispatcher +
                    CoroutineExceptionHandler { _, throwable ->
                        Log.e(TAG, "outbox_io_scope_uncaught", throwable)
                    },
            )

        fun launchOutboxWork(block: suspend CoroutineScope.() -> Unit) {
            scope.launch {
                runCatching { block() }.onFailure { throwable ->
                    Log.e(TAG, "outbox_io_work_failed", throwable)
                }
            }
        }

        private companion object {
            private const val TAG = "SosMeshOutboxIo"
        }
    }

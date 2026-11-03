package com.sosmesh.android.core.data.di

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import javax.inject.Inject
import javax.inject.Singleton

/** Fire-and-forget outbox / BLE side effects off the UI thread. */
@Singleton
class OutboxIoScope
    @Inject
    constructor(
        @IoDispatcher ioDispatcher: CoroutineDispatcher,
    ) : CoroutineScope by CoroutineScope(SupervisorJob() + ioDispatcher)

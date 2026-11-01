package com.sosmesh.android.wear.companion

import android.content.Context
import com.sosmesh.android.core.wear.companion.watch.WearSosCoordinator

object WearAppCoordinatorHolder {
    @Volatile
    private var coordinator: WearSosCoordinator? = null

    fun get(context: Context): WearSosCoordinator {
        val existing = coordinator
        if (existing != null) {
            return existing
        }
        return synchronized(this) {
            coordinator ?: WearSosCoordinator(
                store = InMemoryWearQueueStoreHolder.store,
                transport = GmsWearCompanionTransport(context.applicationContext),
            ).also { coordinator = it }
        }
    }
}

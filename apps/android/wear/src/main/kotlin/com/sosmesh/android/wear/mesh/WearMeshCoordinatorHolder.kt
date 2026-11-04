package com.sosmesh.android.wear.mesh

import android.content.Context
import android.content.SharedPreferences

object WearMeshCoordinatorHolder {
    @Volatile
    private var coordinator: WearMeshCoordinator? = null

    @Volatile
    private var settings: WearRelaySettings? = null

    fun get(context: Context): WearMeshCoordinator {
        val existing = coordinator
        if (existing != null) {
            return existing
        }
        return synchronized(this) {
            coordinator ?: WearMeshCoordinator(
                context = context.applicationContext,
            ).also { coordinator = it }
        }
    }

    fun getSettings(context: Context): WearRelaySettings {
        val existing = settings
        if (existing != null) {
            return existing
        }
        return synchronized(this) {
            settings ?: WearRelaySettings(
                context.applicationContext.getSharedPreferences("wear_relay_prefs", Context.MODE_PRIVATE),
            ).also { settings = it }
        }
    }
}

class WearRelaySettings(private val prefs: SharedPreferences) {
    fun isRelayEnabled(): Boolean = prefs.getBoolean("relay_enabled", false)

    fun setRelayEnabled(enabled: Boolean) {
        prefs.edit().putBoolean("relay_enabled", enabled).apply()
    }
}

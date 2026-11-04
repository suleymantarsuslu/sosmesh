package com.sosmesh.android.broadcast

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BroadcastDialogCoordinator @Inject constructor() {
    data class RelayRequestBroadcast(
        val id: String,
        val title: String,
        val body: String,
    )

    private val _pendingRelayRequest = MutableStateFlow<RelayRequestBroadcast?>(null)
    val pendingRelayRequest: StateFlow<RelayRequestBroadcast?> = _pendingRelayRequest.asStateFlow()

    fun showRelayRequestDialog(
        id: String,
        title: String,
        body: String,
    ) {
        _pendingRelayRequest.value = RelayRequestBroadcast(id, title, body)
    }

    fun dismissRelayRequestDialog() {
        _pendingRelayRequest.value = null
    }
}

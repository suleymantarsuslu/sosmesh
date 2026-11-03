package com.sosmesh.android.feature.status

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sosmesh.android.core.data.mesh.SosPeerDeliveryPort
import com.sosmesh.contracts.transport.OutboxEntryMeta
import com.sosmesh.contracts.transport.OutboxQueueAdapter
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class StatusUiState(
    val entries: List<OutboxEntryMeta> = emptyList(),
    val offline: Boolean = false,
)

@HiltViewModel
class StatusViewModel
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
        private val outbox: OutboxQueueAdapter,
        private val peerDelivery: SosPeerDeliveryPort,
    ) : ViewModel() {
        private val _uiState = MutableStateFlow(StatusUiState())
        val uiState: StateFlow<StatusUiState> = _uiState.asStateFlow()

        private val connectivityManager =
            context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

        private val networkCallback =
            object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    updateNetworkState(offline = false)
                }

                override fun onLost(network: Network) {
                    updateNetworkState(offline = true)
                }

                override fun onCapabilitiesChanged(
                    network: Network,
                    capabilities: NetworkCapabilities,
                ) {
                    val hasInternet = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                    val isValidated = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
                    updateNetworkState(offline = !(hasInternet && isValidated))
                }
            }

        init {
            val request =
                NetworkRequest.Builder()
                    .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                    .addCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
                    .build()
            connectivityManager.registerNetworkCallback(request, networkCallback)
            refresh()
        }

        override fun onCleared() {
            super.onCleared()
            connectivityManager.unregisterNetworkCallback(networkCallback)
        }

        private fun updateNetworkState(offline: Boolean) {
            _uiState.value = _uiState.value.copy(offline = offline)
        }

        fun refresh() {
            viewModelScope.launch {
                runCatching {
                    peerDelivery.runPendingCycle(System.currentTimeMillis(), foregroundVisible = true)
                    val entries = outbox.listAll().sortedByDescending { it.createdAtMs }
                    _uiState.value = _uiState.value.copy(entries = entries)
                }.onFailure { throwable ->
                    if (throwable is CancellationException) throw throwable
                    Log.e("StatusViewModel", "status_refresh_failed", throwable)
                }
            }
        }
    }

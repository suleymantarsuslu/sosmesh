package com.sosmesh.android.ui.radio

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.sosmesh.android.R

@Composable
fun RadioDebugRoute(
    onBack: () -> Unit,
    viewModel: RadioDebugViewModel = hiltViewModel(),
) {
    var status by remember { mutableStateOf(viewModel.refreshStatus()) }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(text = stringResource(R.string.radio_debug_title), style = MaterialTheme.typography.headlineSmall)
        Text(
            text = stringResource(R.string.radio_debug_disclaimer),
            style = MaterialTheme.typography.bodySmall,
        )
        Text(
            text =
                stringResource(
                    R.string.radio_bt_label,
                    if (status.bluetoothEnabled) {
                        stringResource(R.string.status_on)
                    } else {
                        stringResource(R.string.status_off)
                    },
                ),
        )
        Text(
            text =
                stringResource(
                    R.string.radio_permissions_label,
                    if (status.permissionsGranted) {
                        stringResource(R.string.status_granted)
                    } else {
                        stringResource(R.string.status_missing)
                    },
                ),
        )
        Text(
            text =
                stringResource(
                    R.string.radio_location_label,
                    if (status.locationServicesOk) {
                        stringResource(R.string.status_on)
                    } else {
                        stringResource(R.string.status_off)
                    },
                ),
        )
        Text(text = stringResource(R.string.radio_peer_count_label, status.peerCount))
        Text(text = stringResource(R.string.radio_gatt_label, viewModel.gattConnectedLabel(status)))
        Button(onClick = {
            viewModel.startDiscovery().onSuccess { status = viewModel.refreshStatus() }
        }) {
            Text(stringResource(R.string.radio_start_discovery))
        }
        Button(onClick = {
            viewModel.stopDiscovery()
            status = viewModel.refreshStatus()
        }) {
            Text(stringResource(R.string.radio_stop_discovery))
        }
        Button(onClick = {
            viewModel.connectFirstPeer().onSuccess { status = viewModel.refreshStatus() }
        }) {
            Text(stringResource(R.string.radio_connect_peer))
        }
        Button(onClick = {
            viewModel.disconnectPeer()
            status = viewModel.refreshStatus()
        }) {
            Text(stringResource(R.string.radio_disconnect_peer))
        }
        Button(onClick = { status = viewModel.refreshStatus() }) {
            Text(stringResource(R.string.radio_refresh_status))
        }
        Button(onClick = onBack) {
            Text(stringResource(R.string.radio_back))
        }
    }
}

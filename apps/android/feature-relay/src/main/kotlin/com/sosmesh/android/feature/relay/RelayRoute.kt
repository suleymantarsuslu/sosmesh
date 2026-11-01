package com.sosmesh.android.feature.relay

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import com.sosmesh.android.feature.relay.ui.RelayScreen

@Composable
fun RelayRoute(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: RelayViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()
    RelayScreen(
        state = state,
        onToggleRelay = viewModel::setRelayEnabled,
        onStopAndExit = { viewModel.stopRelayAndExit(onBack) },
        modifier = modifier,
    )
}

package com.sosmesh.android.feature.status

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import com.sosmesh.android.feature.status.ui.StatusScreen

@Composable
fun StatusRoute(
    modifier: Modifier = Modifier,
    viewModel: StatusViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()
    StatusScreen(state = state, modifier = modifier)
}

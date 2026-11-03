package com.sosmesh.android.feature.sos

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import com.sosmesh.android.feature.sos.ui.SosFlowScreen

@Composable
fun SosRoute(
    modifier: Modifier = Modifier,
    viewModel: SosFormViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()
    SosFlowScreen(
        state = state,
        onSelectType = viewModel::selectType,
        onPersonCountChange = viewModel::setPersonCountText,
        onPersonUnknownChange = viewModel::setPersonCountUnknown,
        onNoteChange = viewModel::setNote,
        onManualToggle = viewModel::setUseManualLocation,
        onManualLat = viewModel::setManualLat,
        onManualLng = viewModel::setManualLng,
        onPhotoSelected = viewModel::setPhotoUri,
        onVoiceRecorded = viewModel::setVoiceFile,
        onStartRecording = { viewModel.setRecording(true) },
        onStopRecording = { viewModel.setRecording(false) },
        onContinue = viewModel::goToPreview,
        onBackFromPreview = viewModel::backFromPreview,
        onConfirm = viewModel::confirmAndSave,
        modifier = modifier,
    )
}

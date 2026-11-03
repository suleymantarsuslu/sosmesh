package com.sosmesh.android.feature.sos

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.hilt.navigation.compose.hiltViewModel
import com.sosmesh.android.feature.sos.ui.SosFlowScreen

@Composable
fun SosRoute(
    modifier: Modifier = Modifier,
    viewModel: SosFormViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current
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
        onConfirm = {
            viewModel.confirmAndSave()
            state.uploadToken?.let { token ->
                viewModel.scheduleAttachmentUploads(context.applicationContext, token, "https://sosmesh.antiosoft.com")
            }
        },
        modifier = modifier,
    )
}

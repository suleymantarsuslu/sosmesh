package com.sosmesh.android.feature.sos.ui

import android.Manifest
import android.content.Context
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import coil.compose.rememberAsyncImagePainter
import com.sosmesh.android.core.design.theme.SosSpacing
import com.sosmesh.android.feature.sos.R
import com.sosmesh.android.feature.sos.media.ImageCompressor
import com.sosmesh.android.feature.sos.media.VoiceRecorder
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.File

@Composable
fun MediaAttachmentSection(
    hasPhoto: Boolean,
    photoUri: Uri?,
    hasVoice: Boolean,
    voiceDuration: Int,
    isRecording: Boolean,
    onPhotoSelected: (Uri?) -> Unit,
    onVoiceRecorded: (File?) -> Unit,
    onStartRecording: () -> Unit,
    onStopRecording: (Boolean) -> Unit,
    onRemovePhoto: () -> Unit,
    onRemoveVoice: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var tempCameraFile by remember { mutableStateOf<File?>(null) }
    var recordingTimer by remember { mutableStateOf(0) }
    val voiceRecorder = remember { VoiceRecorder(context) }
    
    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            tempCameraFile?.let { file ->
                val uri = ImageCompressor.getTempImageUri(context, file)
                onPhotoSelected(uri)
            }
        }
    }
    
    val audioPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            onStartRecording()
            val file = voiceRecorder.startRecording()
            scope.launch {
                recordingTimer = 0
                while (voiceRecorder.isRecording.value && recordingTimer < 600) {
                    delay(1000)
                    recordingTimer++
                }
                if (recordingTimer >= 600) {
                    val stopped = voiceRecorder.stopRecording(save = true)
                    onVoiceRecorded(stopped)
                    onStopRecording(true)
                }
            }
        }
    }
    
    val photoPickerLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        uri?.let {
            val compressed = ImageCompressor.compress(context, it)
            if (compressed != null) {
                onPhotoSelected(Uri.fromFile(compressed))
            }
        }
    }
    
    val cameraLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.TakePicture()
    ) { success ->
        if (success && tempCameraFile != null) {
            val compressed = ImageCompressor.compress(context, Uri.fromFile(tempCameraFile))
            if (compressed != null) {
                onPhotoSelected(Uri.fromFile(compressed))
            }
        }
        tempCameraFile = null
    }
    
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(SosSpacing.sm)) {
        if (hasPhoto && photoUri != null) {
            AttachmentChip(
                icon = { 
                    Image(
                        painter = rememberAsyncImagePainter(photoUri),
                        contentDescription = null,
                        modifier = Modifier.size(48.dp),
                        contentScale = ContentScale.Crop
                    )
                },
                text = "Photo",
                onRemove = onRemovePhoto
            )
        }
        
        if (hasVoice) {
            AttachmentChip(
                icon = { Icon(Icons.Default.Mic, contentDescription = null) },
                text = stringResource(R.string.sos_voice_duration, formatDuration(voiceDuration)),
                onRemove = onRemoveVoice
            )
        }
        
        if (isRecording) {
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.errorContainer
                )
            ) {
                Column(
                    modifier = Modifier.padding(SosSpacing.md),
                    verticalArrangement = Arrangement.spacedBy(SosSpacing.sm)
                ) {
                    Row(
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            stringResource(R.string.sos_voice_recording),
                            style = MaterialTheme.typography.titleMedium
                        )
                        Text(
                            formatDuration(recordingTimer),
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(SosSpacing.sm)) {
                        Button(
                            onClick = {
                                val file = voiceRecorder.stopRecording(save = true)
                                onVoiceRecorded(file)
                                onStopRecording(true)
                            },
                            modifier = Modifier.weight(1f)
                        ) {
                            Text(stringResource(R.string.sos_voice_stop))
                        }
                        OutlinedButton(
                            onClick = {
                                voiceRecorder.stopRecording(save = false)
                                onStopRecording(false)
                            },
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = MaterialTheme.colorScheme.error
                            ),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text(stringResource(R.string.sos_voice_delete))
                        }
                    }
                }
            }
        }
        
        if (!isRecording) {
            Row(horizontalArrangement = Arrangement.spacedBy(SosSpacing.sm)) {
                OutlinedButton(
                    onClick = {
                        val file = ImageCompressor.createTempImageFile(context)
                        tempCameraFile = file
                        val uri = ImageCompressor.getTempImageUri(context, file)
                        if (hasPermission(context, Manifest.permission.CAMERA)) {
                            cameraLauncher.launch(uri)
                        } else {
                            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                        }
                    },
                    modifier = Modifier.weight(1f),
                    enabled = !hasPhoto
                ) {
                    Icon(Icons.Default.PhotoCamera, contentDescription = null)
                    Spacer(Modifier.width(SosSpacing.xs))
                    Text(stringResource(R.string.sos_attach_photo))
                }
                
                OutlinedButton(
                    onClick = {
                        if (hasPermission(context, Manifest.permission.RECORD_AUDIO)) {
                            onStartRecording()
                            val file = voiceRecorder.startRecording()
                            scope.launch {
                                recordingTimer = 0
                                while (voiceRecorder.isRecording.value && recordingTimer < 600) {
                                    delay(1000)
                                    recordingTimer++
                                }
                                if (recordingTimer >= 600) {
                                    val stopped = voiceRecorder.stopRecording(save = true)
                                    onVoiceRecorded(stopped)
                                    onStopRecording(true)
                                }
                            }
                        } else {
                            audioPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                        }
                    },
                    modifier = Modifier.weight(1f),
                    enabled = !hasVoice
                ) {
                    Icon(Icons.Default.Mic, contentDescription = null)
                    Spacer(Modifier.width(SosSpacing.xs))
                    Text(stringResource(R.string.sos_attach_voice))
                }
            }
        }
    }
    
    DisposableEffect(Unit) {
        onDispose {
            if (isRecording) {
                voiceRecorder.cleanup()
            }
        }
    }
}

@Composable
private fun AttachmentChip(
    icon: @Composable () -> Unit,
    text: String,
    onRemove: () -> Unit
) {
    Card {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(SosSpacing.sm),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(SosSpacing.sm),
                verticalAlignment = Alignment.CenterVertically
            ) {
                icon()
                Text(text, style = MaterialTheme.typography.bodyMedium)
            }
            IconButton(onClick = onRemove) {
                Icon(Icons.Default.Close, contentDescription = "Remove")
            }
        }
    }
}

private fun formatDuration(seconds: Int): String {
    val minutes = seconds / 60
    val secs = seconds % 60
    return String.format("%d:%02d", minutes, secs)
}

private fun hasPermission(context: Context, permission: String): Boolean {
    return androidx.core.content.ContextCompat.checkSelfPermission(
        context,
        permission
    ) == android.content.pm.PackageManager.PERMISSION_GRANTED
}

package com.sosmesh.android.feature.sos.media

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.io.File

class VoiceRecorder(private val context: Context) {
    private var recorder: MediaRecorder? = null
    private var outputFile: File? = null
    private val _isRecording = MutableStateFlow(false)
    val isRecording: StateFlow<Boolean> = _isRecording.asStateFlow()
    
    private val _duration = MutableStateFlow(0)
    val duration: StateFlow<Int> = _duration.asStateFlow()
    
    fun startRecording(): File? {
        val file = File(context.cacheDir, "voice_${System.currentTimeMillis()}.m4a")
        outputFile = file
        
        val mediaRecorder = createMediaRecorder()
        recorder = mediaRecorder.apply {
            setAudioSource(MediaRecorder.AudioSource.MIC)
            setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            setAudioSamplingRate(44100)
            setAudioEncodingBitRate(96000)
            setMaxDuration(600_000)
            setOutputFile(file.absolutePath)
            
            setOnInfoListener { _, what, _ ->
                if (what == MediaRecorder.MEDIA_RECORDER_INFO_MAX_DURATION_REACHED) {
                    stopRecording(save = true)
                }
            }
            
            try {
                prepare()
                start()
                _isRecording.value = true
                _duration.value = 0
            } catch (e: Exception) {
                release()
                recorder = null
                return null
            }
        }
        
        return file
    }
    
    fun updateDuration(seconds: Int) {
        _duration.value = seconds
    }
    
    fun stopRecording(save: Boolean): File? {
        val file = outputFile
        recorder?.apply {
            try {
                stop()
            } catch (e: Exception) {
            }
            release()
        }
        recorder = null
        _isRecording.value = false
        _duration.value = 0
        
        return if (save) {
            file
        } else {
            file?.delete()
            null
        }
    }
    
    fun cleanup() {
        stopRecording(save = false)
    }
}

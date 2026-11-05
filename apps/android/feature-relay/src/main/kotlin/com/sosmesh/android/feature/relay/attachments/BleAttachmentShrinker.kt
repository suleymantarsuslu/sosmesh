package com.sosmesh.android.feature.relay.attachments

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.ByteBuffer

/**
 * WhatsApp-style shrinking of the BLE-carried copy only (the sender's own later direct upload keeps the original).
 * Platform APIs only. Never drops: images step down edge + quality, audio is trimmed to the cap.
 */
object BleAttachmentShrinker {
    /** Media bytes before encryption. The JSON-base64 inner + ChaCha20 tag put ~215 KB / ~171 KB on the air. */
    const val MAX_IMAGE_BYTES: Int = 160 * 1024
    const val MAX_AUDIO_BYTES: Int = 128 * 1024

    private val IMAGE_EDGES = intArrayOf(1280, 1024, 800, 640, 480, 320)
    private val IMAGE_QUALITIES = intArrayOf(70, 50, 35)

    /** Downscales (longest edge), applies EXIF orientation, re-encodes JPEG with stepped quality. EXIF/GPS is not carried over. */
    fun shrinkImage(
        file: File,
        maxBytes: Int = MAX_IMAGE_BYTES,
    ): ByteArray? {
        return try {
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(file.absolutePath, bounds)
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
            val rotation = exifRotationDegrees(file)
            val longest = maxOf(bounds.outWidth, bounds.outHeight)
            for (edge in IMAGE_EDGES) {
                val opts =
                    BitmapFactory.Options().apply {
                        inSampleSize = sampleSizeFor(longest, edge)
                    }
                val decoded = BitmapFactory.decodeFile(file.absolutePath, opts) ?: continue
                val scale = minOf(1f, edge.toFloat() / maxOf(decoded.width, decoded.height))
                val matrix =
                    Matrix().apply {
                        postScale(scale, scale)
                        if (rotation != 0) postRotate(rotation.toFloat())
                    }
                val bitmap = Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true)
                if (bitmap !== decoded) decoded.recycle()
                try {
                    for (quality in IMAGE_QUALITIES) {
                        val out = ByteArrayOutputStream()
                        bitmap.compress(Bitmap.CompressFormat.JPEG, quality, out)
                        if (out.size() <= maxBytes) return out.toByteArray()
                    }
                } finally {
                    bitmap.recycle()
                }
            }
            null
        } catch (_: Throwable) {
            null
        }
    }

    /**
     * Audio: the recorder already writes mono 16 kHz ~24 kbps AAC, so normally the file is returned as-is. Anything
     * larger is cut (sample copy, no re-encode) at the cap instead of being dropped.
     */
    fun shrinkAudio(
        file: File,
        workDir: File,
        maxBytes: Int = MAX_AUDIO_BYTES,
    ): ByteArray? {
        return try {
            if (file.length() <= maxBytes) return file.readBytes()
            workDir.mkdirs()
            val out = File(workDir, "trim_${file.name}")
            out.delete()
            if (!trimToBudget(file, out, maxBytes - AUDIO_CONTAINER_SLACK)) return null
            val bytes = out.readBytes()
            out.delete()
            bytes.takeIf { it.isNotEmpty() && it.size <= maxBytes }
        } catch (_: Throwable) {
            null
        }
    }

    private fun trimToBudget(
        src: File,
        dst: File,
        sampleBudget: Int,
    ): Boolean {
        val extractor = MediaExtractor()
        var muxer: MediaMuxer? = null
        var started = false
        try {
            extractor.setDataSource(src.absolutePath)
            val track =
                (0 until extractor.trackCount).firstOrNull {
                    extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
                } ?: return false
            extractor.selectTrack(track)
            muxer = MediaMuxer(dst.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
            val index = muxer.addTrack(extractor.getTrackFormat(track))
            muxer.start()
            started = true
            val buffer = ByteBuffer.allocate(64 * 1024)
            val info = MediaCodec.BufferInfo()
            var total = 0
            var written = 0
            while (true) {
                buffer.clear()
                val size = extractor.readSampleData(buffer, 0)
                if (size < 0 || total + size > sampleBudget) break
                info.set(0, size, extractor.sampleTime, MediaCodec.BUFFER_FLAG_KEY_FRAME)
                muxer.writeSampleData(index, buffer, info)
                total += size
                written++
                extractor.advance()
            }
            return written > 0
        } finally {
            try {
                if (started) muxer?.stop()
            } catch (_: Exception) {
            }
            try {
                muxer?.release()
            } catch (_: Exception) {
            }
            extractor.release()
        }
    }

    internal fun sampleSizeFor(
        longestEdge: Int,
        target: Int,
    ): Int {
        var sample = 1
        while (longestEdge / (sample * 2) >= target) sample *= 2
        return sample
    }

    private fun exifRotationDegrees(file: File): Int =
        try {
            when (ExifInterface(file.absolutePath).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
                ExifInterface.ORIENTATION_ROTATE_90 -> 90
                ExifInterface.ORIENTATION_ROTATE_180 -> 180
                ExifInterface.ORIENTATION_ROTATE_270 -> 270
                else -> 0
            }
        } catch (_: Exception) {
            0
        }

    private const val AUDIO_CONTAINER_SLACK = 6 * 1024
}

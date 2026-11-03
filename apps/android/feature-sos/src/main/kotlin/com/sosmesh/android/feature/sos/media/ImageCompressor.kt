package com.sosmesh.android.feature.sos.media

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.core.content.FileProvider
import java.io.ByteArrayOutputStream
import java.io.File
import android.content.Context

object ImageCompressor {
    private const val MAX_IMAGE_BYTES = 15_000_000
    
    fun compress(context: Context, uri: Uri): File? {
        return try {
            val inputStream = context.contentResolver.openInputStream(uri) ?: return null
            val bitmap = BitmapFactory.decodeStream(inputStream)
            inputStream.close()
            
            var quality = 90
            var compressedData: ByteArray
            
            do {
                val outputStream = ByteArrayOutputStream()
                bitmap.compress(Bitmap.CompressFormat.JPEG, quality, outputStream)
                compressedData = outputStream.toByteArray()
                quality -= 10
            } while (compressedData.size > MAX_IMAGE_BYTES && quality > 10)
            
            if (compressedData.size > MAX_IMAGE_BYTES) {
                val scale = kotlin.math.sqrt(MAX_IMAGE_BYTES.toDouble() / compressedData.size)
                val newWidth = (bitmap.width * scale).toInt()
                val newHeight = (bitmap.height * scale).toInt()
                val scaledBitmap = Bitmap.createScaledBitmap(bitmap, newWidth, newHeight, true)
                
                val outputStream = ByteArrayOutputStream()
                scaledBitmap.compress(Bitmap.CompressFormat.JPEG, 85, outputStream)
                compressedData = outputStream.toByteArray()
                scaledBitmap.recycle()
            }
            
            bitmap.recycle()
            
            val outputFile = File(context.cacheDir, "photo_${System.currentTimeMillis()}.jpg")
            outputFile.writeBytes(compressedData)
            outputFile
        } catch (e: Exception) {
            null
        }
    }
    
    fun createTempImageFile(context: Context): File {
        val cacheDir = File(context.cacheDir, "camera")
        cacheDir.mkdirs()
        return File(cacheDir, "photo_${System.currentTimeMillis()}.jpg")
    }
    
    fun getTempImageUri(context: Context, file: File): Uri {
        return FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file
        )
    }
}

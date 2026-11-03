package com.sosmesh.android.feature.sos.attachment

import android.content.Context
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File
import java.util.concurrent.locks.ReentrantReadWriteLock
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.concurrent.read
import kotlin.concurrent.write

@Serializable
data class PendingAttachmentRecord(
    val sosId: String,
    val kind: String,
    val filePath: String,
    val mimeType: String,
    val uploadToken: String? = null,
    val baseUrl: String? = null,
)

/**
 * Simple file-based store for pending attachments awaiting upload tokens.
 */
@Singleton
class AttachmentPendingStore
    @Inject
    constructor(
        private val context: Context,
    ) {
        private val json = Json { ignoreUnknownKeys = true }
        private val lock = ReentrantReadWriteLock()
        private val storeFile: File
            get() = File(context.filesDir, "pending_attachments.json")

    fun add(attachment: PendingAttachment) {
        lock.write {
            val records = loadRecords().toMutableList()
            records.add(
                PendingAttachmentRecord(
                    sosId = attachment.sosId,
                    kind = attachment.kind,
                    filePath = attachment.filePath,
                    mimeType = attachment.mimeType,
                    uploadToken = null,
                    baseUrl = null,
                ),
            )
            saveRecords(records)
        }
    }

    fun listBySosId(sosId: String): List<PendingAttachment> {
        return lock.read {
            loadRecords()
                .filter { it.sosId == sosId }
                .map {
                    PendingAttachment(
                        sosId = it.sosId,
                        kind = it.kind,
                        filePath = it.filePath,
                        mimeType = it.mimeType,
                        uploadToken = it.uploadToken,
                        baseUrl = it.baseUrl,
                    )
                }
        }
    }
    
    fun listAll(): List<PendingAttachment> {
        return lock.read {
            loadRecords().map {
                PendingAttachment(
                    sosId = it.sosId,
                    kind = it.kind,
                    filePath = it.filePath,
                    mimeType = it.mimeType,
                    uploadToken = it.uploadToken,
                    baseUrl = it.baseUrl,
                )
            }
        }
    }
    
    fun setUploadToken(sosId: String, uploadToken: String, baseUrl: String) {
        lock.write {
            val records = loadRecords().toMutableList()
            var updated = false
            for (i in records.indices) {
                if (records[i].sosId == sosId && records[i].uploadToken == null) {
                    records[i] = records[i].copy(uploadToken = uploadToken, baseUrl = baseUrl)
                    updated = true
                }
            }
            if (updated) {
                saveRecords(records)
            }
        }
    }
    
    fun removeByFilePath(filePath: String) {
        lock.write {
            val records = loadRecords().filter { it.filePath != filePath }
            saveRecords(records)
        }
    }

    fun removeBySosId(sosId: String) {
        lock.write {
            val records = loadRecords().filter { it.sosId != sosId }
            saveRecords(records)
        }
    }

        private fun loadRecords(): List<PendingAttachmentRecord> {
            if (!storeFile.exists()) return emptyList()
            return try {
                val text = storeFile.readText()
                json.decodeFromString<List<PendingAttachmentRecord>>(text)
            } catch (_: Exception) {
                emptyList()
            }
        }

        private fun saveRecords(records: List<PendingAttachmentRecord>) {
            try {
                val text = json.encodeToString(records)
                storeFile.writeText(text)
            } catch (_: Exception) {
            }
        }
    }

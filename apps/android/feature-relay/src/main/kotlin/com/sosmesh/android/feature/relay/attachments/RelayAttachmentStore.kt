package com.sosmesh.android.feature.relay.attachments

import android.content.Context
import com.sosmesh.android.core.protocol.BleAttachmentWire
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Relay side: opaque encrypted attachment copies received over BLE, kept as files until the relay has the SOS upload
 * token. Bounded (4 per SOS, 24 MB total, oldest evicted first). Never decrypted here.
 */
@Singleton
class RelayAttachmentStore
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) {
        private val root: File get() = File(context.filesDir, "relay_attachments").also { it.mkdirs() }

        private fun dirFor(sosId: String): File = File(root, sosId.filter { it.isLetterOrDigit() || it == '-' || it == '_' }.take(80).ifEmpty { "x" })

        @Synchronized
        fun save(payload: ByteArray): BleAttachmentWire.Parsed? {
            val parsed = BleAttachmentWire.decode(payload) ?: return null
            val dir = dirFor(parsed.sosId).also { it.mkdirs() }
            val target = File(dir, "${parsed.attachmentId}.att")
            if (target.exists()) return parsed
            if (dir.listFiles { f -> f.extension == "att" }.orEmpty().size >= BleAttachmentWire.MAX_ATTACHMENTS_PER_SOS) return null
            evictToFit(payload.size)
            target.writeBytes(payload)
            return parsed
        }

        @Synchronized
        fun setUploadToken(
            sosId: String,
            token: String,
        ) {
            val dir = dirFor(sosId).also { it.mkdirs() }
            File(dir, TOKEN_FILE).writeText(token)
        }

        @Synchronized
        fun uploadToken(sosId: String): String? = File(dirFor(sosId), TOKEN_FILE).takeIf { it.exists() }?.readText()?.takeIf { it.isNotBlank() }

        @Synchronized
        fun pendingFiles(sosId: String): List<File> =
            dirFor(sosId).listFiles { f -> f.extension == "att" }.orEmpty().sortedBy { it.name }

        /** SOS ids that hold at least one stored copy and an upload token (retry set). */
        @Synchronized
        fun sosIdsReadyForUpload(): List<String> =
            root.listFiles { f -> f.isDirectory }.orEmpty()
                .filter { File(it, TOKEN_FILE).exists() && it.listFiles { f -> f.extension == "att" }.orEmpty().isNotEmpty() }
                .map { it.name }

        /** The token file stays so a copy arriving after the SOS upload can still be sent; stale dirs are trimmed by age. */
        @Synchronized
        fun delete(file: File) {
            file.delete()
        }

        private fun evictToFit(incoming: Int) {
            val files = root.walkTopDown().filter { it.isFile && it.extension == "att" }.sortedBy { it.lastModified() }.toMutableList()
            var total = files.sumOf { it.length() } + incoming
            while (total > MAX_TOTAL_BYTES && files.isNotEmpty()) {
                val oldest = files.removeAt(0)
                total -= oldest.length()
                oldest.delete()
            }
            val cutoff = System.currentTimeMillis() - STALE_MS
            root.listFiles { f -> f.isDirectory && f.lastModified() < cutoff }.orEmpty().forEach { it.deleteRecursively() }
        }

        private companion object {
            const val TOKEN_FILE = "token"
            const val MAX_TOTAL_BYTES = 24L * 1024 * 1024
            const val STALE_MS = 72L * 3_600_000L
        }
    }

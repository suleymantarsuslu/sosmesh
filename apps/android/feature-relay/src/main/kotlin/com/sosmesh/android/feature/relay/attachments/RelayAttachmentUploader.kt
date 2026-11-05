package com.sosmesh.android.feature.relay.attachments

import com.sosmesh.android.core.protocol.BleAttachmentWire
import com.sosmesh.android.feature.relay.uplink.RelayIngestConfig
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Uploads the opaque encrypted copies a relay carried (POST /v1/device/attachments/relayed, multipart) with the upload
 * token of the relay's own SOS ingest. Permanent 4xx drops the copy; network / 5xx / 429 keeps it for the next cycle.
 */
@Singleton
class RelayAttachmentUploader
    @Inject
    constructor(
        private val store: RelayAttachmentStore,
        private val config: RelayIngestConfig,
    ) {
        /** The relay got a token for this SOS: remember it and send everything already stored. */
        fun onSosUploaded(
            sosId: String,
            uploadToken: String?,
        ) {
            if (uploadToken.isNullOrBlank()) return
            store.setUploadToken(sosId, uploadToken)
            uploadFor(sosId)
        }

        /** A copy arrived (possibly after the SOS itself already went up). */
        fun onAttachmentStored(sosId: String) {
            if (store.uploadToken(sosId) != null) uploadFor(sosId)
        }

        fun retryAll() {
            store.sosIdsReadyForUpload().forEach { uploadFor(it) }
        }

        fun uploadFor(sosId: String) {
            val token = store.uploadToken(sosId) ?: return
            if (config.ingestUrl.isBlank() || (config.requireHttps && !config.ingestUrl.startsWith("https://", ignoreCase = true))) return
            val endpoint = config.ingestUrl.substringBeforeLast("/v1/") + "/v1/device/attachments/relayed"
            for (file in store.pendingFiles(sosId)) {
                val parsed = BleAttachmentWire.decode(file.readBytes())
                if (parsed == null) {
                    store.delete(file)
                    continue
                }
                when (post(endpoint, token, parsed, file)) {
                    Outcome.DONE, Outcome.REJECTED -> store.delete(file)
                    Outcome.RETRY -> return
                }
            }
        }

        private enum class Outcome { DONE, REJECTED, RETRY }

        private fun post(
            endpoint: String,
            token: String,
            p: BleAttachmentWire.Parsed,
            file: File,
        ): Outcome {
            val boundary = "----sosmesh${UUID.randomUUID().toString().replace("-", "")}"
            val body = ByteArrayOutputStream()
            fun field(
                name: String,
                value: String,
            ) {
                body.write("--$boundary\r\nContent-Disposition: form-data; name=\"$name\"\r\n\r\n$value\r\n".toByteArray())
            }
            field("kind", p.kind)
            field("attachmentId", p.attachmentId)
            field("nonce", p.nonce)
            field("ephemeralPublicKey", p.ephemeralPublicKey)
            field("keyId", p.keyId)
            body.write(
                "--$boundary\r\nContent-Disposition: form-data; name=\"file\"; filename=\"${file.nameWithoutExtension}.bin\"\r\nContent-Type: application/octet-stream\r\n\r\n".toByteArray(),
            )
            body.write(p.ciphertext)
            body.write("\r\n--$boundary--\r\n".toByteArray())
            return try {
                val connection =
                    (URL(endpoint).openConnection() as HttpURLConnection).apply {
                        requestMethod = "POST"
                        connectTimeout = 15_000
                        readTimeout = 30_000
                        doOutput = true
                        setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
                        setRequestProperty("x-upload-token", token)
                    }
                connection.outputStream.use { it.write(body.toByteArray()) }
                when (connection.responseCode) {
                    in 200..299 -> Outcome.DONE
                    429 -> Outcome.RETRY
                    in 400..499 -> Outcome.REJECTED
                    else -> Outcome.RETRY
                }
            } catch (_: IOException) {
                Outcome.RETRY
            }
        }
    }

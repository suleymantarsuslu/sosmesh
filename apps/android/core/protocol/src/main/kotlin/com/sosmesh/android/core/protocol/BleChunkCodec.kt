package com.sosmesh.android.core.protocol

import java.nio.ByteBuffer
import java.security.MessageDigest
import java.util.zip.CRC32

object BleChunkCodec {
    fun calculateCrc32(data: ByteArray): Long {
        val crc = CRC32()
        crc.update(data)
        return crc.value and 0xffffffffL
    }

    fun calculateDigest(data: ByteArray): ByteArray = MessageDigest.getInstance("SHA-256").digest(data)

    fun splitIntoChunks(
        data: ByteArray,
        chunkSize: Int,
    ): List<Chunk> {
        val totalChunks = (data.size + chunkSize - 1) / chunkSize
        val chunks = mutableListOf<Chunk>()
        for (i in 0 until totalChunks) {
            val start = i * chunkSize
            val end = minOf(start + chunkSize, data.size)
            val payload = data.copyOfRange(start, end)
            var flags = 0
            if (i == 0) flags = flags or ChunkFlags.FIRST_CHUNK.bit
            if (i == totalChunks - 1) flags = flags or ChunkFlags.LAST_CHUNK.bit
            chunks.add(
                Chunk(
                    header =
                        ChunkHeader(
                            seq = i,
                            total = totalChunks,
                            crc32 = calculateCrc32(payload),
                            flags = flags,
                        ),
                    payload = payload,
                ),
            )
        }
        return chunks
    }

    fun serializeChunk(chunk: Chunk): ByteArray {
        val header = ByteArray(BleProtocolTypes.CHUNK_HEADER_SIZE)
        header[0] = ((chunk.header.seq shr 8) and 0xff).toByte()
        header[1] = (chunk.header.seq and 0xff).toByte()
        header[2] = ((chunk.header.total shr 8) and 0xff).toByte()
        header[3] = (chunk.header.total and 0xff).toByte()
        val crc = chunk.header.crc32
        header[4] = ((crc shr 24) and 0xff).toByte()
        header[5] = ((crc shr 16) and 0xff).toByte()
        header[6] = ((crc shr 8) and 0xff).toByte()
        header[7] = (crc and 0xff).toByte()
        header[8] = chunk.header.flags.toByte()
        header[9] = ((chunk.payload.size shr 8) and 0xff).toByte()
        header[10] = (chunk.payload.size and 0xff).toByte()
        header[11] = 0
        return header + chunk.payload
    }

    fun deserializeChunk(data: ByteArray): Chunk? {
        if (data.size < BleProtocolTypes.CHUNK_HEADER_SIZE) return null
        val seq = ((data[0].toInt() and 0xff) shl 8) or (data[1].toInt() and 0xff)
        val total = ((data[2].toInt() and 0xff) shl 8) or (data[3].toInt() and 0xff)
        val crc32 =
            ((data[4].toLong() and 0xff) shl 24) or
                ((data[5].toLong() and 0xff) shl 16) or
                ((data[6].toLong() and 0xff) shl 8) or
                (data[7].toLong() and 0xff)
        val flags = data[8].toInt() and 0xff
        val payloadLen = ((data[9].toInt() and 0xff) shl 8) or (data[10].toInt() and 0xff)
        if (data.size < BleProtocolTypes.CHUNK_HEADER_SIZE + payloadLen) return null
        val payload = data.copyOfRange(BleProtocolTypes.CHUNK_HEADER_SIZE, BleProtocolTypes.CHUNK_HEADER_SIZE + payloadLen)
        return Chunk(ChunkHeader(seq, total, crc32, flags), payload)
    }

    fun assembleChunks(chunks: List<Chunk>): ByteArray {
        val sorted = chunks.sortedBy { it.header.seq }
        val totalSize = sorted.sumOf { it.payload.size }
        val buffer = ByteBuffer.allocate(totalSize)
        sorted.forEach { buffer.put(it.payload) }
        return buffer.array()
    }

    fun extractDigestFromLastChunk(lastChunk: Chunk): Pair<ByteArray, ByteArray>? {
        if (!ChunkFlags.LAST_CHUNK.has(lastChunk.header.flags)) return null
        if (lastChunk.payload.size < 32) return null
        val digest = lastChunk.payload.copyOfRange(lastChunk.payload.size - 32, lastChunk.payload.size)
        val data = lastChunk.payload.copyOfRange(0, lastChunk.payload.size - 32)
        return digest to data
    }

    fun verifyDigest(
        assembled: ByteArray,
        digest: ByteArray,
    ): Boolean = calculateDigest(assembled).contentEquals(digest)

    fun createLastChunkWithDigest(
        fullPayload: ByteArray,
        chunkSize: Int,
        seq: Int,
        total: Int,
    ): Chunk {
        val digest = calculateDigest(fullPayload)
        val dataStart = seq * chunkSize
        val dataEnd = minOf(dataStart + chunkSize - 32, fullPayload.size)
        val chunkData = fullPayload.copyOfRange(dataStart, dataEnd)
        val payload = chunkData + digest
        return Chunk(
            header =
                ChunkHeader(
                    seq = seq,
                    total = total,
                    crc32 = calculateCrc32(payload),
                    flags = ChunkFlags.LAST_CHUNK.bit,
                ),
            payload = payload,
        )
    }
}

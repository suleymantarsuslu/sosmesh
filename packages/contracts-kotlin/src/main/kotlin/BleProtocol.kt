package com.sosmesh.ble

import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.MessageDigest
import java.util.zip.CRC32

object BleProtocol {
    const val PROTOCOL_VERSION: Byte = 0x01
    const val CHUNK_HEADER_SIZE = 12

    fun calculateCRC32(data: ByteArray): Long {
        val crc = CRC32()
        crc.update(data)
        return crc.value
    }

    fun calculateSHA256(data: ByteArray): ByteArray {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(data)
    }

    data class ChunkHeader(
        val seq: Int,
        val total: Int,
        val crc32: Long,
        val flags: Byte,
    )

    fun serializeChunkHeader(header: ChunkHeader): ByteArray {
        val buffer = ByteBuffer.allocate(CHUNK_HEADER_SIZE)
        buffer.order(ByteOrder.BIG_ENDIAN)
        buffer.putShort(header.seq.toShort())
        buffer.putShort(header.total.toShort())
        buffer.putInt(header.crc32.toInt())
        buffer.put(header.flags)
        // 3 bytes reserved (0x00)
        buffer.put(0)
        buffer.put(0)
        buffer.put(0)
        return buffer.array()
    }

    fun deserializeChunkHeader(data: ByteArray): ChunkHeader {
        require(data.size >= CHUNK_HEADER_SIZE) { "Data too small for chunk header" }

        val buffer = ByteBuffer.wrap(data)
        buffer.order(ByteOrder.BIG_ENDIAN)

        val seq = buffer.short.toInt() and 0xFFFF
        val total = buffer.short.toInt() and 0xFFFF
        val crc32 = buffer.int.toLong() and 0xFFFFFFFFL
        val flags = buffer.get()

        return ChunkHeader(seq, total, crc32, flags)
    }

    fun verifyChunkCRC(
        header: ChunkHeader,
        payload: ByteArray,
    ): Boolean {
        val actualCRC = calculateCRC32(payload)
        return actualCRC == header.crc32
    }
}

package com.sosmesh.android.core.ble

import com.sosmesh.ble.BleProtocol
import java.nio.ByteBuffer
import java.nio.ByteOrder
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import kotlin.random.Random

interface Clock {
    fun currentTimeMillis(): Long
}

object SystemClock : Clock {
    override fun currentTimeMillis(): Long = System.currentTimeMillis()
}

/**
 * Rotating opaque identifier for advertisements (ble-v1.md).
 * Does not embed device name, MAC, or IMEI.
 */
class EphemeralIdGenerator(
    private val clock: Clock = SystemClock,
    private val random: Random = Random.Default,
) {
    private val sessionSecret: ByteArray = ByteArray(32).also { random.nextBytes(it) }

    fun currentOpaqueId(): ByteArray {
        val hourBucket = clock.currentTimeMillis() / 3_600_000L
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(sessionSecret, "HmacSHA256"))
        mac.update(ByteBuffer.allocate(8).order(ByteOrder.BIG_ENDIAN).putLong(hourBucket).array())
        val digest = mac.doFinal()
        return digest.copyOfRange(0, BleMeshConstants.OPAQUE_ID_BYTES)
    }

    fun manufacturerPayload(): ByteArray {
        val opaque = currentOpaqueId()
        require(opaque.size == BleMeshConstants.OPAQUE_ID_BYTES)
        val buffer = ByteBuffer.allocate(1 + BleMeshConstants.OPAQUE_ID_BYTES)
        buffer.put(BleProtocol.PROTOCOL_VERSION)
        buffer.put(opaque)
        return buffer.array()
    }
}

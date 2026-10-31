package com.sosmesh.android.core.protocol

import com.sosmesh.android.core.ble.BleMeshConstants

/**
 * In-memory full-duplex BLE link for JVM tests (mirrors packages/ble-protocol mock-transport).
 */
class MockBleTransferChannel(
    private val packetLossRate: Double = 0.0,
    private val duplicateRate: Double = 0.0,
    private val rng: BleTransferRng = SeededBleTransferRng(42),
) {
    private val pending = ArrayDeque<Triple<GattBleTransferTransport, String, ByteArray>>()

    fun createTransportPair(): Pair<GattBleTransferTransport, GattBleTransferTransport> {
        lateinit var senderTransport: GattBleTransferTransport
        lateinit var receiverTransport: GattBleTransferTransport
        senderTransport =
            GattBleTransferTransport(
                object : GattOutboundWriter {
                    override fun writeCharacteristic(
                        uuid: String,
                        value: ByteArray,
                    ) {
                        scheduleDelivery(receiverTransport, uuid, value)
                    }
                },
            )
        receiverTransport =
            GattBleTransferTransport(
                object : GattOutboundWriter {
                    override fun writeCharacteristic(
                        uuid: String,
                        value: ByteArray,
                    ) {
                        scheduleDelivery(senderTransport, uuid, value)
                    }
                },
            )
        return senderTransport to receiverTransport
    }

    fun scheduleDelivery(
        target: GattBleTransferTransport,
        uuid: String,
        value: ByteArray,
    ) {
        pending.add(Triple(target, uuid, value.copyOf()))
    }

    fun deliverAll() {
        while (pending.isNotEmpty()) {
            val (target, uuid, data) = pending.removeFirst()
            val isDataChar = uuid.uppercase() == BleMeshConstants.DATA_CHAR_UUID.uppercase()
            if (isDataChar && rng.nextUnit() < packetLossRate) continue
            target.deliverIncoming(uuid, data)
            if (isDataChar && rng.nextUnit() < duplicateRate) {
                target.deliverIncoming(uuid, data)
            }
        }
    }

    fun queueSize(): Int = pending.size

    fun routeUuid(data: ByteArray): String {
        val type = data[0].toInt() and 0xff
        return when (type) {
            MessageType.HELLO.wire,
            MessageType.RESUME_REQUEST.wire,
            -> BleMeshConstants.CONTROL_CHAR_UUID
            MessageType.HELLO_ACK.wire,
            MessageType.ACK.wire,
            MessageType.NACK.wire,
            MessageType.TRANSFER_VERIFIED.wire,
            -> BleMeshConstants.ACK_CHAR_UUID
            else -> BleMeshConstants.DATA_CHAR_UUID
        }
    }
}

package com.sosmesh.android.core.protocol

import com.sosmesh.android.core.ble.BleMeshConstants

interface BleTransferTransport {
    fun send(data: ByteArray)

    fun setIncomingHandler(handler: ((ByteArray) -> Unit)?)

    fun close()
}

/**
 * Routes protocol frames to GATT characteristics (ble-v1.md).
 */
class GattBleTransferTransport(
    private val outbound: GattOutboundWriter,
) : BleTransferTransport {
    private var incoming: ((ByteArray) -> Unit)? = null

    override fun send(data: ByteArray) {
        if (data.isEmpty()) return
        val type = data[0].toInt() and 0xff
        val uuid =
            when (type) {
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
        outbound.writeCharacteristic(uuid, data)
    }

    fun deliverIncoming(
        uuid: String,
        value: ByteArray,
    ) {
        if (value.isEmpty()) return
        val normalized =
            when (uuid.uppercase()) {
                BleMeshConstants.CONTROL_CHAR_UUID.uppercase(),
                BleMeshConstants.DATA_CHAR_UUID.uppercase(),
                BleMeshConstants.ACK_CHAR_UUID.uppercase(),
                -> value
                else -> return
            }
        incoming?.invoke(normalized)
    }

    override fun setIncomingHandler(handler: ((ByteArray) -> Unit)?) {
        incoming = handler
    }

    override fun close() {
        incoming = null
    }
}

interface GattOutboundWriter {
    fun writeCharacteristic(
        uuid: String,
        value: ByteArray,
    )
}

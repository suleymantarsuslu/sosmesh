package com.sosmesh.android.core.protocol

import com.sosmesh.android.core.ble.BleMeshConstants
import com.sosmesh.android.core.ble.MeshV2Hooks
import com.sosmesh.android.core.ble.platform.GattClientCallbackPort
import com.sosmesh.android.core.ble.platform.GattClientPort
import com.sosmesh.android.core.ble.platform.GattServerConnectionListener
import com.sosmesh.android.core.ble.platform.GattServerPort
import com.sosmesh.android.core.ble.platform.GattServerWriteListener
import kotlinx.coroutines.sync.withLock
import javax.inject.Inject
import javax.inject.Singleton

private data class ReceiverSession(
    val receiver: BleTransferReceiver,
    val transport: GattBleTransferTransport,
)

@Singleton
class BleTransferEngine
    @Inject
    constructor(
        private val serverPort: GattServerPort,
        private val clientPort: GattClientPort,
        private val peerDeliveryTracker: SosPeerDeliveryTracker,
    ) : BleTransferEnginePort {
        private val receiverSessions = mutableMapOf<String, ReceiverSession>()
        private var relayListener: BleTransferReceiver.Listener? = null

        private val centralTransport =
            GattBleTransferTransport(
                object : GattOutboundWriter {
                    override fun writeCharacteristic(
                        uuid: String,
                        value: ByteArray,
                    ) {
                        clientPort.writeCharacteristic(uuid, value)
                    }
                },
            )
        private val sender = BleTransferSender(centralTransport)

        private fun getOrCreateReceiverSession(deviceAddress: String): ReceiverSession =
            receiverSessions.getOrPut(deviceAddress) {
                val transport =
                    GattBleTransferTransport(
                        object : GattOutboundWriter {
                            override fun writeCharacteristic(
                                uuid: String,
                                value: ByteArray,
                            ) {
                                serverPort.notifyCharacteristic(uuid, value, deviceAddress)
                            }
                        },
                    )
                val receiver = BleTransferReceiver(transport)
                relayListener?.let { receiver.setListener(it) }
                ReceiverSession(receiver, transport)
            }

        init {
            peerDeliveryTracker.attachSenderListener(sender)
            serverPort.setWriteListener(
                object : GattServerWriteListener {
                    override fun onCharacteristicWrite(
                        uuid: String,
                        value: ByteArray,
                        deviceAddress: String,
                    ) {
                        if (uuid.equals(BleMeshConstants.CONTROL_CHAR_UUID, ignoreCase = true)) {
                            val replies =
                                MeshV2Hooks.hooks?.onControlFrame(value, System.currentTimeMillis(), MESH_V2_MAX_NOTIFY_BYTES)
                            if (replies != null) {
                                replies.forEach { frame ->
                                    serverPort.notifyCharacteristic(BleMeshConstants.ACK_CHAR_UUID, frame, deviceAddress)
                                }
                                return
                            }
                        }
                        val session = getOrCreateReceiverSession(deviceAddress)
                        session.transport.deliverIncoming(uuid, value)
                    }
                },
            )
            serverPort.setConnectionListener(
                object : GattServerConnectionListener {
                    override fun onConnectionStateChanged(
                        deviceAddress: String,
                        connected: Boolean,
                    ) {
                        if (!connected) {
                            onPeerDisconnected(deviceAddress)
                        }
                    }
                },
            )
            clientPort.setClientDataListener(
                object : GattClientCallbackPort {
                    override fun onConnectionStateChanged(state: com.sosmesh.android.core.ble.platform.GattConnectionState) = Unit

                    override fun onServicesDiscovered() = Unit

                    override fun onMtuChanged(mtu: Int) = Unit

                    override fun onCharacteristicChanged(
                        uuid: String,
                        value: ByteArray,
                    ) {
                        if (uuid.equals(BleMeshConstants.ACK_CHAR_UUID, ignoreCase = true) && value.isNotEmpty() &&
                            (value[0] == MESH_V2_OFFER_REPLY || value[0] == MESH_V2_TOMBSTONE)
                        ) {
                            meshV2Replies.trySend(value.copyOf())
                            return
                        }
                        centralTransport.deliverIncoming(uuid, value)
                    }
                },
            )
        }

        private val meshV2Replies = kotlinx.coroutines.channels.Channel<ByteArray>(kotlinx.coroutines.channels.Channel.UNLIMITED)
        private val meshV2Mutex = kotlinx.coroutines.sync.Mutex()

        override suspend fun meshV2Exchange(
            frame: ByteArray,
            replyType: Byte,
            windowMs: Long,
            maxFrames: Int,
        ): List<ByteArray>? =
            meshV2Mutex.withLock {
                if (!clientPort.hasCharacteristic(MeshV2Hooks.MESH_INFO_CHAR_UUID)) return@withLock null
                while (meshV2Replies.tryReceive().isSuccess) Unit
                clientPort.enableAckNotifications()
                var written = false
                for (attempt in 0 until WRITE_ATTEMPTS) {
                    kotlinx.coroutines.delay(WRITE_RETRY_MS)
                    if (clientPort.writeCharacteristic(BleMeshConstants.CONTROL_CHAR_UUID, frame).isSuccess) {
                        written = true
                        break
                    }
                }
                if (!written) return@withLock emptyList()
                val out = mutableListOf<ByteArray>()
                kotlinx.coroutines.withTimeoutOrNull(windowMs) {
                    while (out.size < maxFrames) {
                        val next = meshV2Replies.receive()
                        if (next[0] == replyType) out += next
                    }
                }
                out
            }

        fun setRelayListener(listener: BleTransferReceiver.Listener) {
            relayListener = listener
            receiverSessions.values.forEach { it.receiver.setListener(listener) }
        }

        @Inject
        fun wireRelayReceiver(relayListener: BleTransferReceiver.Listener) {
            setRelayListener(relayListener)
        }

        fun onPeerDisconnected(deviceAddress: String) {
            receiverSessions[deviceAddress]?.receiver?.onTransportDisconnected()
        }

        override fun sendOutbound(
            sosId: String,
            digest: String,
            payload: ByteArray,
        ) {
            peerDeliveryTracker.active = SosPeerDeliveryTracker.ActiveTransfer(sosId, digest)
            clientPort.enableAckNotifications()
            sender.startTransfer(payload)
        }

        /** Multihop relay forward: opaque wire bytes only; does not touch sender outbox PEER_RECEIVED gate. */
        override fun sendOpaqueForward(payload: ByteArray) {
            clientPort.enableAckNotifications()
            sender.startTransfer(payload)
        }

        fun receiverState(): TransferState =
            receiverSessions.values.firstOrNull()?.receiver?.getState() ?: TransferState.IDLE

        override fun senderState(): TransferState = sender.getState()

        override fun onGattReady() {
            clientPort.enableAckNotifications()
        }
    }

/** TOMBSTONE frames are ≤ 170 B; conservative default ATT payload for a 185 MTU link. */
private const val MESH_V2_MAX_NOTIFY_BYTES = 182
private const val MESH_V2_OFFER_REPLY: Byte = 0x31
private const val MESH_V2_TOMBSTONE: Byte = 0x34
private const val WRITE_ATTEMPTS = 6
private const val WRITE_RETRY_MS = 120L

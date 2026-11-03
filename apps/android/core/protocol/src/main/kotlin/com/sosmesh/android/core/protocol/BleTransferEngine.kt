package com.sosmesh.android.core.protocol

import com.sosmesh.android.core.ble.platform.GattClientCallbackPort
import com.sosmesh.android.core.ble.platform.GattClientPort
import com.sosmesh.android.core.ble.platform.GattServerPort
import com.sosmesh.android.core.ble.platform.GattServerWriteListener
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BleTransferEngine
    @Inject
    constructor(
        private val serverPort: GattServerPort,
        private val clientPort: GattClientPort,
        private val peerDeliveryTracker: SosPeerDeliveryTracker,
    ) : BleTransferEnginePort {
        private val peripheralTransport =
            GattBleTransferTransport(
                object : GattOutboundWriter {
                    override fun writeCharacteristic(
                        uuid: String,
                        value: ByteArray,
                    ) {
                        serverPort.notifyCharacteristic(uuid, value, null)
                    }
                },
            )
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
        private val receiver = BleTransferReceiver(peripheralTransport)
        private val sender = BleTransferSender(centralTransport)

        init {
            peerDeliveryTracker.attachSenderListener(sender)
            serverPort.setWriteListener(
                object : GattServerWriteListener {
                    override fun onCharacteristicWrite(
                        uuid: String,
                        value: ByteArray,
                        deviceAddress: String,
                    ) {
                        peripheralTransport.deliverIncoming(uuid, value)
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
                        centralTransport.deliverIncoming(uuid, value)
                    }
                },
            )
        }

        fun setRelayListener(listener: BleTransferReceiver.Listener) {
            receiver.setListener(listener)
        }

        @Inject
        fun wireRelayReceiver(relayListener: BleTransferReceiver.Listener) {
            setRelayListener(relayListener)
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

        fun receiverState(): TransferState = receiver.getState()

        override fun senderState(): TransferState = sender.getState()

        override fun onGattReady() {
            clientPort.enableAckNotifications()
        }
    }

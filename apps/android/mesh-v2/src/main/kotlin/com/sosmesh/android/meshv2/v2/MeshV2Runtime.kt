package com.sosmesh.android.meshv2.v2

import com.sosmesh.android.core.ble.MeshV2BleHooks
import com.sosmesh.android.core.ble.MeshV2Hooks
import javax.inject.Inject
import javax.inject.Singleton

/** App-provided identity / key for mesh v2. */
data class MeshV2Config(
    val relayIdHex: String,
    val receiptVerifyPublicKeySpkiBase64: String,
    val isWatch: Boolean = false,
)

/**
 * Process-wide mesh v2 node bound to the BLE layer through [MeshV2Hooks]. No payload or PII logging.
 */
@Singleton
class MeshV2Runtime
    @Inject
    constructor(
        config: MeshV2Config,
    ) : MeshV2BleHooks {
        val node: MeshV2Node =
            MeshV2Node(
                carry = if (config.isWatch) CarryStore(maxItems = 20, maxBytes = 256 * 1024) else CarryStore(),
                verifier = TombstoneVerifier(SpkiEd25519Verifier(config.receiptVerifyPublicKeySpkiBase64)),
                selfDeviceIdHash = MeshV2Wire.hex(MeshV2Wire.sha256(config.relayIdHex.toByteArray(Charsets.UTF_8))),
                relayIdHex = config.relayIdHex,
                isWatch = config.isWatch,
            )

        fun install() {
            MeshV2Hooks.hooks = this
        }

        /** §4.1: any 2xx/4xx from the SOSMesh API proves validated internet. */
        fun onApiResponse(
            httpCode: Int,
            nowMs: Long,
        ) {
            if (httpCode in 200..499) node.hops.onApiReachable(nowMs)
        }

        /** Gateway path: a verified /v1/ingest receipt is a tombstone (hopsLeft = 8). */
        fun onVerifiedReceipt(
            tombstone: DeliveryTombstone,
            nowMs: Long,
        ) {
            node.applyTombstones(listOf(tombstone.copy(hopsLeft = MeshV2Wire.MAX_HOPS)), nowMs)
        }

        override fun meshInfo(nowMs: Long): ByteArray = node.meshInfo(nowMs).encode()

        override fun advertisementServiceData(nowMs: Long): ByteArray = node.advertisementServiceData(nowMs)

        override fun onControlFrame(
            value: ByteArray,
            nowMs: Long,
            maxNotifyBytes: Int,
        ): List<ByteArray>? {
            if (!MeshV2FrameCodec.isV2ControlFrame(value)) return null
            return node.onControlFrame(value, nowMs, maxNotifyBytes)
        }

        override fun onAdvertisement(
            peerAddress: String,
            rssi: Int,
            serviceData: ByteArray?,
            shortServiceUuids: List<Int>,
            nowMs: Long,
        ) {
            val h =
                MeshV2Advertisement.parseAndroidServiceData(serviceData)?.h
                    ?: MeshV2Advertisement.parseIosHopsUuids(shortServiceUuids)
            node.hops.onNeighbour(
                GatewayHopsTracker.Neighbour(
                    peerId = peerAddress,
                    h = h,
                    selfKey = null,
                    parentKey = null,
                    lastSeenMs = nowMs,
                    liveLink = false,
                    rssi = rssi,
                ),
            )
        }
    }

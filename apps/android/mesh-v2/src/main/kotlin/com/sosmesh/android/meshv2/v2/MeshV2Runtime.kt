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
    val broadcastVerifier: ((ServerBroadcast) -> Boolean)? = null,
    val broadcastNotifier: ((ServerBroadcast) -> Unit)? = null,
    val locationProvider: (() -> Pair<Double, Double>?)? = null,
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
                broadcastVerifier = config.broadcastVerifier,
                broadcastNotifier = config.broadcastNotifier,
                locationProvider = config.locationProvider,
            )

        /** Called for every verified tombstone (gateway receipt or mesh), e.g. to purge relay outbox rows. */
        @Volatile var tombstoneListener: ((DeliveryTombstone) -> Unit)? = null

        private val pushedTo = HashMap<String, MutableSet<MessageKey>>()
        private val json = kotlinx.serialization.json.Json { encodeDefaults = true }

        private fun applyAndNotify(
            items: List<DeliveryTombstone>,
            nowMs: Long,
        ) {
            node.applyTombstones(items, nowMs)
            items.filter { node.tombstones.get(it.messageKey) != null }.forEach { t -> tombstoneListener?.invoke(t) }
        }

        override fun offerFrame(messageIds: List<String>): ByteArray =
            MeshV2FrameCodec.encodeOffer(messageIds.take(MeshV2Wire.MAX_KEYS_PER_FRAME).map { MeshV2Wire.messageKey(it) })

        override fun parseOfferReply(frame: ByteArray): List<Int>? =
            (MeshV2FrameCodec.decode(frame) as? MeshV2Frame.OfferReply)?.statuses?.map { it.code }

        override fun tombstoneRequestFrame(messageIds: List<String>): ByteArray =
            MeshV2FrameCodec.encodeTombstoneRequest(messageIds.take(MeshV2Wire.MAX_KEYS_PER_FRAME).map { MeshV2Wire.messageKey(it) })

        override fun onTombstoneFrames(
            frames: List<ByteArray>,
            nowMs: Long,
        ) {
            val items = frames.mapNotNull { (MeshV2FrameCodec.decode(it) as? MeshV2Frame.Tombstone)?.tombstone }
            if (items.isNotEmpty()) applyAndNotify(items, nowMs)
        }

        override fun takeTombstoneBatchFor(
            peerId: String,
            nowMs: Long,
        ): ByteArray? =
            synchronized(pushedTo) {
                node.tombstones.prune(nowMs)
                val sent = pushedTo.getOrPut(peerId) { HashSet() }
                val fresh = node.tombstones.all().filter { it.hopsLeft > 0 && it.messageKey !in sent }.take(TombstoneBatchV2.MAX_ITEMS)
                if (fresh.isEmpty()) return null
                fresh.forEach { sent += it.messageKey }
                json.encodeToString(TombstoneBatchV2.serializer(), TombstoneBatchV2(items = fresh.map { it.copy(hopsLeft = it.hopsLeft - 1) }))
                    .toByteArray(Charsets.UTF_8)
            }

        private val broadcastPushedTo = HashMap<String, MutableSet<String>>()

        fun takeBroadcastFor(peerId: String, nowMs: Long): ServerBroadcast? =
            synchronized(broadcastPushedTo) {
                node.broadcasts.prune(nowMs)
                val sent = broadcastPushedTo.getOrPut(peerId) { HashSet() }
                val ordered = node.broadcasts.ordered()
                val fresh = ordered.firstOrNull { it.broadcast.hopsLeft > 0 && it.id !in sent }
                if (fresh != null) {
                    sent += fresh.id
                    return node.forwardBroadcast(fresh.broadcast)
                }
                null
            }

        /** Peripheral path: a TombstoneBatchV2 transfer arrived. Returns true if it was a batch. */
        fun onTransferPayloadTombstones(
            payload: ByteArray,
            nowMs: Long,
        ): Boolean {
            val p = node.classify(payload) as? MeshV2Payload.Tombstones ?: return false
            applyAndNotify(p.batch.items, nowMs)
            return true
        }

        @Volatile var carryMeta: CarryMetaStore = CarryMetaStore(null)
            private set

        val selfDeviceIdHash: String = MeshV2Wire.hex(MeshV2Wire.sha256(config.relayIdHex.toByteArray(Charsets.UTF_8)))

        /** [storageDir] = app filesDir; loading happens on the caller thread, so call from background or accept one small read. */
        fun install(storageDir: java.io.File? = null) {
            if (storageDir != null) carryMeta = CarryMetaStore(java.io.File(storageDir, "mesh_v2_carry_meta.json"))
            MeshV2Hooks.hooks = this
            installed = this
        }

        companion object {
            /** Process-wide instance after [install]; null in unit tests that do not install it. */
            @Volatile var installed: MeshV2Runtime? = null
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
            applyAndNotify(listOf(tombstone.copy(hopsLeft = MeshV2Wire.MAX_HOPS)), nowMs)
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

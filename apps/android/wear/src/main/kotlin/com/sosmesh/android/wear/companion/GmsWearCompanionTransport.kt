package com.sosmesh.android.wear.companion

import android.content.Context
import com.google.android.gms.wearable.CapabilityClient
import com.google.android.gms.wearable.Node
import com.google.android.gms.wearable.Wearable
import com.sosmesh.android.core.wear.companion.protocol.WearCompanionPaths
import com.sosmesh.android.core.wear.companion.queue.InMemoryWearOfflineQueueStore
import com.sosmesh.android.core.wear.companion.queue.WearOfflineQueueStore
import com.sosmesh.android.core.wear.companion.transport.WearCompanionTransport
import java.util.concurrent.atomic.AtomicReference

object InMemoryWearQueueStoreHolder {
    val store: WearOfflineQueueStore = InMemoryWearOfflineQueueStore()
}

class GmsWearCompanionTransport(
    context: Context,
) : WearCompanionTransport {
    private val appContext = context.applicationContext
    private val capabilityClient: CapabilityClient = Wearable.getCapabilityClient(appContext)
    private val lastReachableNode = AtomicReference<Node?>(null)

    override fun isPhoneReachable(): Boolean = lastReachableNode.get() != null

    override fun sendCreateToPhone(
        payload: ByteArray,
        onSuccess: () -> Unit,
        onFailure: (String) -> Unit,
    ) {
        capabilityClient
            .getCapability(WearCompanionPaths.CAPABILITY_PHONE, CapabilityClient.FILTER_REACHABLE)
            .addOnSuccessListener { info ->
                val node = info.nodes.firstOrNull()
                if (node == null) {
                    lastReachableNode.set(null)
                    onFailure("phone_not_reachable")
                } else {
                    lastReachableNode.set(node)
                    sendCreateToNode(node.id, payload, onSuccess, onFailure)
                }
            }
            .addOnFailureListener {
                lastReachableNode.set(null)
                onFailure(it.message ?: "capability_failed")
            }
    }

    override fun sendCreateToNode(
        nodeId: String,
        payload: ByteArray,
        onSuccess: () -> Unit,
        onFailure: (String) -> Unit,
    ) {
        Wearable.getMessageClient(appContext)
            .sendMessage(nodeId, WearCompanionPaths.SOS_CREATE, payload)
            .addOnSuccessListener { onSuccess() }
            .addOnFailureListener { onFailure(it.message ?: "send_failed") }
    }
}

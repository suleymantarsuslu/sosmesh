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
                val node = info.nodes.firstOrNull { it.isNearby } ?: info.nodes.firstOrNull()
                if (node == null) {
                    sendViaConnectedNodes(payload, onSuccess, onFailure)
                } else {
                    lastReachableNode.set(node)
                    sendCreateToNode(node.id, payload, onSuccess, onFailure)
                }
            }
            .addOnFailureListener {
                sendViaConnectedNodes(payload, onSuccess, onFailure)
            }
    }

    /**
     * Fallback when the phone capability is not (yet) advertised: send to a connected node.
     * Only the SOSMesh phone app registers a listener for this path, so other nodes ignore it
     * and the phone answers with an ACK that clears the queue.
     */
    private fun sendViaConnectedNodes(
        payload: ByteArray,
        onSuccess: () -> Unit,
        onFailure: (String) -> Unit,
    ) {
        Wearable.getNodeClient(appContext).connectedNodes
            .addOnSuccessListener { nodes ->
                val node = nodes.firstOrNull { it.isNearby } ?: nodes.firstOrNull()
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
                onFailure(it.message ?: "nodes_failed")
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

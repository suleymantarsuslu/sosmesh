package com.sosmesh.android.feature.relay

import com.sosmesh.android.core.protocol.BleTransferReceiver
import com.sosmesh.android.core.protocol.ErrorCode
import com.sosmesh.android.feature.relay.uplink.RelayIdentityProvider
import com.sosmesh.android.meshv2.MeshV2RelayAction
import com.sosmesh.android.meshv2.MeshV2RelayCoordinator
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RelayTransferHandler
    @Inject
    constructor(
        private val registrar: RelayEnvelopeRegistrar,
        private val meshV2RelayCoordinator: MeshV2RelayCoordinator,
        private val relayIdentityProvider: RelayIdentityProvider,
    ) : BleTransferReceiver.Listener {
        override fun onCompleted(payload: ByteArray) {
            val nowMs = System.currentTimeMillis()
            val meshResult =
                meshV2RelayCoordinator.onWirePayload(
                    payload = payload,
                    relayDeviceIdHash = relayIdentityProvider.relayIdHex,
                    nowMs = nowMs,
                    batteryQuotaAllowsForward = true,
                    uplinkInternetAvailable = false,
                )
            if (meshResult.action == MeshV2RelayAction.LegacyPassthrough) {
                registrar.registerFromWirePayload(payload, nowMs)
            } else if (
                meshResult.action == MeshV2RelayAction.StoredForUplink ||
                meshResult.action == MeshV2RelayAction.QueuedForForward
            ) {
                registrar.registerFromWirePayload(payload, nowMs)
            }
        }

        override fun onFailed(
            code: ErrorCode,
            message: String,
        ) {
            // Relay path surfaces radio errors via registrar/outbox retry in later ADIM; skeleton logs only.
        }
    }

package com.sosmesh.android.mesh

import com.sosmesh.android.core.data.mesh.SosPeerDeliveryKickResult
import com.sosmesh.android.core.data.mesh.SosPeerDeliveryPort
import com.sosmesh.android.core.protocol.SosPeerDeliveryCycleResult
import com.sosmesh.android.core.protocol.SosPeerDeliveryOrchestrator
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AppSosPeerDeliveryPort
    @Inject
    constructor(
        private val orchestrator: SosPeerDeliveryOrchestrator,
    ) : SosPeerDeliveryPort {
        override fun kickOffAfterLocalSave(
            nowMs: Long,
            foregroundVisible: Boolean,
        ): SosPeerDeliveryKickResult = orchestrator.runCycle(nowMs, foregroundVisible).toKickResult()

        override fun runPendingCycle(
            nowMs: Long,
            foregroundVisible: Boolean,
        ): SosPeerDeliveryKickResult = orchestrator.runCycle(nowMs, foregroundVisible).toKickResult()

        private fun SosPeerDeliveryCycleResult.toKickResult(): SosPeerDeliveryKickResult =
            when (this) {
                SosPeerDeliveryCycleResult.Idle -> SosPeerDeliveryKickResult.Idle
                SosPeerDeliveryCycleResult.TransferStarted -> SosPeerDeliveryKickResult.TransferStarted
                SosPeerDeliveryCycleResult.WaitingForGatt -> SosPeerDeliveryKickResult.WaitingForGatt
                SosPeerDeliveryCycleResult.SenderBusy -> SosPeerDeliveryKickResult.SenderBusy
                is SosPeerDeliveryCycleResult.PermissionsMissing ->
                    SosPeerDeliveryKickResult.PermissionsMissing(missing)
                is SosPeerDeliveryCycleResult.Blocked -> SosPeerDeliveryKickResult.Blocked(reason)
            }
    }

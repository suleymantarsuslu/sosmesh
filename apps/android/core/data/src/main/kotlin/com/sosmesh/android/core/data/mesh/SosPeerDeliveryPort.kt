package com.sosmesh.android.core.data.mesh

/**
 * Starts or advances BLE peer delivery for locally saved SOS outbox rows (origin android).
 */
interface SosPeerDeliveryPort {
    fun kickOffAfterLocalSave(
        nowMs: Long,
        foregroundVisible: Boolean,
    ): SosPeerDeliveryKickResult

    fun runPendingCycle(
        nowMs: Long,
        foregroundVisible: Boolean,
    ): SosPeerDeliveryKickResult
}

sealed class SosPeerDeliveryKickResult {
    data object Idle : SosPeerDeliveryKickResult()

    data object TransferStarted : SosPeerDeliveryKickResult()

    data object WaitingForGatt : SosPeerDeliveryKickResult()

    data object SenderBusy : SosPeerDeliveryKickResult()

    data class PermissionsMissing(
        val missing: List<String>,
    ) : SosPeerDeliveryKickResult()

    data class Blocked(
        val reason: String,
    ) : SosPeerDeliveryKickResult()
}

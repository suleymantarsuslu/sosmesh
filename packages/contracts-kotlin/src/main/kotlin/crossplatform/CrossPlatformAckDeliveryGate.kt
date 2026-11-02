package com.sosmesh.contracts.crossplatform

enum class AckGateRejectReason {
    CRC_MISMATCH,
    DIGEST_INVALID,
    AWAITING_TRANSFER_VERIFIED,
}

data class AckGateTransferInput(
    val crcValid: Boolean,
    val digestValid: Boolean,
    val chunkAcksComplete: Boolean,
    val transferVerified: Boolean,
)

data class AckGateTransferResult(
    val mayEmitPeerReceived: Boolean,
    val mayEmitServerAccepted: Boolean,
    val rejectReason: AckGateRejectReason?,
)

object CrossPlatformAckDeliveryGate {
    fun evaluateTransfer(input: AckGateTransferInput): AckGateTransferResult {
        if (!input.crcValid) {
            return AckGateTransferResult(false, false, AckGateRejectReason.CRC_MISMATCH)
        }
        if (!input.digestValid) {
            return AckGateTransferResult(false, false, AckGateRejectReason.DIGEST_INVALID)
        }
        if (!input.transferVerified) {
            return AckGateTransferResult(false, false, AckGateRejectReason.AWAITING_TRANSFER_VERIFIED)
        }
        return AckGateTransferResult(true, false, null)
    }

    fun peerReceivedIfIgnoringVerified(input: AckGateTransferInput): Boolean =
        input.crcValid && input.digestValid && input.chunkAcksComplete

    data class DeliveryStateGateResult(
        val mayEmitPeerReceived: Boolean,
        val mayEmitServerAccepted: Boolean,
        val allowedNextStates: List<String>,
        val forbiddenNextStates: List<String>,
    )

    fun evaluateDeliveryState(deliveryState: String): DeliveryStateGateResult =
        when (deliveryState) {
            "PEER_RECEIVED" ->
                DeliveryStateGateResult(
                    mayEmitPeerReceived = true,
                    mayEmitServerAccepted = false,
                    allowedNextStates = listOf("SERVER_ACCEPTED", "FAILED", "EXPIRED"),
                    forbiddenNextStates = listOf("OPERATOR_SEEN", "CASE_IN_PROGRESS"),
                )
            "LOCAL_SAVED" ->
                DeliveryStateGateResult(
                    mayEmitPeerReceived = false,
                    mayEmitServerAccepted = false,
                    allowedNextStates = listOf("PEER_RECEIVED", "FAILED", "EXPIRED"),
                    forbiddenNextStates = listOf("SERVER_ACCEPTED"),
                )
            else ->
                DeliveryStateGateResult(
                    mayEmitPeerReceived = false,
                    mayEmitServerAccepted = deliveryState == "PEER_RECEIVED",
                    allowedNextStates = emptyList(),
                    forbiddenNextStates = emptyList(),
                )
        }
}

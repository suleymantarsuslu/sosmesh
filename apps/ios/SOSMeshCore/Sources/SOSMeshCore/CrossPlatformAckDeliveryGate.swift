import Foundation

public enum CrossPlatformAckRejectReason: String, Equatable {
    case crcMismatch = "CRC_MISMATCH"
    case digestInvalid = "DIGEST_INVALID"
    case awaitingTransferVerified = "AWAITING_TRANSFER_VERIFIED"
}

public struct CrossPlatformAckTransferInput: Equatable {
    public var crcValid: Bool
    public var digestValid: Bool
    public var chunkAcksComplete: Bool
    public var transferVerified: Bool

    public init(crcValid: Bool, digestValid: Bool, chunkAcksComplete: Bool, transferVerified: Bool) {
        self.crcValid = crcValid
        self.digestValid = digestValid
        self.chunkAcksComplete = chunkAcksComplete
        self.transferVerified = transferVerified
    }
}

public struct CrossPlatformAckTransferResult: Equatable {
    public var mayEmitPeerReceived: Bool
    public var mayEmitServerAccepted: Bool
    public var rejectReason: CrossPlatformAckRejectReason?
}

public enum CrossPlatformAckDeliveryGate {
    public static func evaluateTransfer(_ input: CrossPlatformAckTransferInput) -> CrossPlatformAckTransferResult {
        if !input.crcValid {
            return CrossPlatformAckTransferResult(
                mayEmitPeerReceived: false,
                mayEmitServerAccepted: false,
                rejectReason: .crcMismatch
            )
        }
        if !input.digestValid {
            return CrossPlatformAckTransferResult(
                mayEmitPeerReceived: false,
                mayEmitServerAccepted: false,
                rejectReason: .digestInvalid
            )
        }
        if !input.transferVerified {
            return CrossPlatformAckTransferResult(
                mayEmitPeerReceived: false,
                mayEmitServerAccepted: false,
                rejectReason: .awaitingTransferVerified
            )
        }
        return CrossPlatformAckTransferResult(
            mayEmitPeerReceived: true,
            mayEmitServerAccepted: false,
            rejectReason: nil
        )
    }

    public static func peerReceivedIfIgnoringVerified(_ input: CrossPlatformAckTransferInput) -> Bool {
        input.crcValid && input.digestValid && input.chunkAcksComplete
    }

    public struct DeliveryStateGateResult: Equatable {
        public var mayEmitPeerReceived: Bool
        public var mayEmitServerAccepted: Bool
        public var allowedNextStates: [String]
        public var forbiddenNextStates: [String]
    }

    public static func evaluateDeliveryState(_ deliveryState: String) -> DeliveryStateGateResult {
        switch deliveryState {
        case "PEER_RECEIVED":
            return DeliveryStateGateResult(
                mayEmitPeerReceived: true,
                mayEmitServerAccepted: false,
                allowedNextStates: ["SERVER_ACCEPTED", "FAILED", "EXPIRED"],
                forbiddenNextStates: ["OPERATOR_SEEN", "CASE_IN_PROGRESS"]
            )
        case "LOCAL_SAVED":
            return DeliveryStateGateResult(
                mayEmitPeerReceived: false,
                mayEmitServerAccepted: false,
                allowedNextStates: ["PEER_RECEIVED", "FAILED", "EXPIRED"],
                forbiddenNextStates: ["SERVER_ACCEPTED"]
            )
        default:
            return DeliveryStateGateResult(
                mayEmitPeerReceived: false,
                mayEmitServerAccepted: deliveryState == "PEER_RECEIVED",
                allowedNextStates: [],
                forbiddenNextStates: []
            )
        }
    }
}

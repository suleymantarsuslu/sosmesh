export interface AckGateTransferInput {
  crcValid: boolean;
  digestValid: boolean;
  chunkAcksComplete: boolean;
  transferVerified: boolean;
}

export type AckGateRejectReason =
  | 'CRC_MISMATCH'
  | 'DIGEST_INVALID'
  | 'AWAITING_TRANSFER_VERIFIED'
  | null;

export interface AckGateTransferResult {
  mayEmitPeerReceived: boolean;
  mayEmitServerAccepted: boolean;
  rejectReason: AckGateRejectReason;
}

/**
 * BLE v1 gate: PEER_RECEIVED only after digest + TRANSFER_VERIFIED (not chunk ACK alone).
 */
export function evaluateTransferAckGate(input: AckGateTransferInput): AckGateTransferResult {
  if (!input.crcValid) {
    return {
      mayEmitPeerReceived: false,
      mayEmitServerAccepted: false,
      rejectReason: 'CRC_MISMATCH',
    };
  }
  if (!input.digestValid) {
    return {
      mayEmitPeerReceived: false,
      mayEmitServerAccepted: false,
      rejectReason: 'DIGEST_INVALID',
    };
  }
  if (!input.transferVerified) {
    return {
      mayEmitPeerReceived: false,
      mayEmitServerAccepted: false,
      rejectReason: 'AWAITING_TRANSFER_VERIFIED',
    };
  }
  return {
    mayEmitPeerReceived: true,
    mayEmitServerAccepted: false,
    rejectReason: null,
  };
}

export interface DeliveryStateGateInput {
  deliveryState: string;
}

export interface DeliveryStateGateResult {
  mayEmitPeerReceived: boolean;
  mayEmitServerAccepted: boolean;
  allowedNextStates: string[];
  forbiddenNextStates: string[];
}

const PEER_NEXT = ['SERVER_ACCEPTED', 'FAILED', 'EXPIRED'];
const LOCAL_NEXT = ['PEER_RECEIVED', 'FAILED', 'EXPIRED'];

export function evaluateDeliveryStateGate(input: DeliveryStateGateInput): DeliveryStateGateResult {
  if (input.deliveryState === 'PEER_RECEIVED') {
    return {
      mayEmitPeerReceived: true,
      mayEmitServerAccepted: false,
      allowedNextStates: PEER_NEXT,
      forbiddenNextStates: ['OPERATOR_SEEN', 'CASE_IN_PROGRESS'],
    };
  }
  if (input.deliveryState === 'LOCAL_SAVED') {
    return {
      mayEmitPeerReceived: false,
      mayEmitServerAccepted: false,
      allowedNextStates: LOCAL_NEXT,
      forbiddenNextStates: ['SERVER_ACCEPTED'],
    };
  }
  return {
    mayEmitPeerReceived: false,
    mayEmitServerAccepted: input.deliveryState === 'PEER_RECEIVED',
    allowedNextStates: [],
    forbiddenNextStates: [],
  };
}

/** Mutation sentinel: disabling verified gate would wrongly allow peer ACK. */
export function peerReceivedIfIgnoringVerified(input: AckGateTransferInput): boolean {
  return input.crcValid && input.digestValid && input.chunkAcksComplete;
}

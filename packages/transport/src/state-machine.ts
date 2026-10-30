import {
  loadStateTransitionsFixture,
  type TransportState,
  type StateTransitionsFixture,
} from './fixture-path';

export class InvalidStateTransitionError extends Error {
  constructor(
    public readonly from: TransportState,
    public readonly to: TransportState
  ) {
    super(`Invalid state transition: ${from} -> ${to}`);
    this.name = 'InvalidStateTransitionError';
  }
}

export class DeliveryStateMachine {
  private readonly fixture: StateTransitionsFixture;
  private readonly allowed: Set<string>;

  constructor(fixture: StateTransitionsFixture = loadStateTransitionsFixture()) {
    this.fixture = fixture;
    this.allowed = new Set(
      fixture.validTransitions.map((t) => `${t.from}->${t.to}`)
    );
  }

  get progressOrder(): TransportState[] {
    return [...this.fixture.progressOrder];
  }

  get terminalStates(): TransportState[] {
    return [...this.fixture.terminalStates];
  }

  canTransition(from: TransportState, to: TransportState): boolean {
    return this.allowed.has(`${from}->${to}`);
  }

  transition(from: TransportState, to: TransportState): TransportState {
    if (!this.canTransition(from, to)) {
      throw new InvalidStateTransitionError(from, to);
    }
    return to;
  }

  isTerminal(state: TransportState): boolean {
    return this.fixture.terminalStates.includes(state);
  }

  isProgress(state: TransportState): boolean {
    return this.fixture.progressOrder.includes(state as TransportState);
  }
}

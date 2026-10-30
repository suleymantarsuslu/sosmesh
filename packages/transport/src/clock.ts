export interface IClock {
  nowMs(): number;
}

export class SystemClock implements IClock {
  nowMs(): number {
    return Date.now();
  }
}

export class SimulatedClock implements IClock {
  private currentMs: number;

  constructor(startMs = 1_700_000_000_000) {
    this.currentMs = startMs;
  }

  nowMs(): number {
    return this.currentMs;
  }

  advance(ms: number): void {
    this.currentMs += ms;
  }

  set(ms: number): void {
    this.currentMs = ms;
  }
}

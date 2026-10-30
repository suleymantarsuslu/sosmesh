import type { IRNG } from '@sosmesh/ble-protocol';

/** Linear congruential generator — same constants as ble-protocol integration tests. */
export class SeededRNG implements IRNG {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed >>> 0;
  }

  random(): number {
    const a = 1664525;
    const c = 1013904223;
    const m = 2 ** 32;
    this.seed = (a * this.seed + c) % m;
    return this.seed / m;
  }

  fork(offset: number): SeededRNG {
    const next = new SeededRNG(this.seed);
    for (let i = 0; i < offset; i++) {
      next.random();
    }
    return next;
  }
}

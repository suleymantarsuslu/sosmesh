type Window = { count: number; windowStartMs: number };

export class TenantAiRateLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(
    private readonly maxPerWindow: number,
    private readonly windowMs: number
  ) {}

  tryConsume(tenantKey: string, nowMs = Date.now()): boolean {
    const existing = this.windows.get(tenantKey);
    if (!existing || nowMs - existing.windowStartMs >= this.windowMs) {
      this.windows.set(tenantKey, { count: 1, windowStartMs: nowMs });
      return true;
    }
    if (existing.count >= this.maxPerWindow) {
      return false;
    }
    existing.count += 1;
    return true;
  }
}

export class AiCostGuard {
  private spentUsd = 0;
  private utcDayKey = '';

  constructor(private readonly maxUsdPerDay: number) {}

  private utcDayKeyFor(nowMs: number): string {
    return new Date(nowMs).toISOString().slice(0, 10);
  }

  tryCharge(estimatedUsd: number, nowMs = Date.now()): boolean {
    const dayKey = this.utcDayKeyFor(nowMs);
    if (dayKey !== this.utcDayKey) {
      this.utcDayKey = dayKey;
      this.spentUsd = 0;
    }
    if (this.spentUsd + estimatedUsd > this.maxUsdPerDay) {
      return false;
    }
    this.spentUsd += estimatedUsd;
    return true;
  }

  reset(): void {
    this.spentUsd = 0;
    this.utcDayKey = '';
  }
}

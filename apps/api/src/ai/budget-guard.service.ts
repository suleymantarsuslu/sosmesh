/**
 * BudgetGuard - DB-backed AI budget management
 * Work Package A - AI Foundation
 * 
 * Reserve-then-reconcile pattern:
 * 1. Reserve estimated cost before API call
 * 2. Make API call
 * 3. Reconcile with actual usage
 * 
 * Safe across concurrent processes (transaction + advisory lock)
 */

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type BudgetCheckResult =
  | { allowed: true }
  | { allowed: false; reason: 'daily_limit' | 'total_limit' | 'circuit_open' };

export type ReservationResult =
  | { reserved: true; reservationId: string }
  | { reserved: false; reason: 'daily_limit' | 'total_limit' };

export type ReconcileRequest = {
  reservationId: string;
  actualUsd: number;
  inputTokens: number;
  outputTokens: number;
  model: string;
  requestId: string;
};

@Injectable()
export class BudgetGuardService {
  private readonly logger = new Logger(BudgetGuardService.name);
  private readonly dailyBudgetUsd: number;
  private readonly totalBudgetUsd: number;

  constructor(private readonly prisma: PrismaService) {
    this.dailyBudgetUsd = Number(process.env.AI_DAILY_BUDGET_USD ?? 30);
    this.totalBudgetUsd = Number(process.env.AI_TOTAL_BUDGET_USD ?? 150);
  }

  /**
   * Check if AI operations are allowed without reserving budget
   */
  async check(): Promise<BudgetCheckResult> {
    const today = this.getToday();

    const [dailyUsage, totalUsage] = await Promise.all([
      this.getDailyUsage(today),
      this.getTotalUsage(),
    ]);

    if (dailyUsage >= this.dailyBudgetUsd) {
      return { allowed: false, reason: 'daily_limit' };
    }

    if (totalUsage >= this.totalBudgetUsd) {
      return { allowed: false, reason: 'total_limit' };
    }

    return { allowed: true };
  }

  /**
   * Reserve budget before making an API call
   * Returns reservationId for later reconciliation
   */
  async reserve(estimatedUsd: number, model: string): Promise<ReservationResult> {
    const today = this.getToday();

    try {
      // Use advisory lock to prevent concurrent reservation races
      const lockKey = this.getLockKey(today);
      
      return await this.prisma.$transaction(async (tx) => {
        // Acquire advisory lock
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

        const [dailyUsage, totalUsage] = await Promise.all([
          this.getDailyUsage(today, tx),
          this.getTotalUsage(tx),
        ]);

        if (dailyUsage + estimatedUsd > this.dailyBudgetUsd) {
          return { reserved: false, reason: 'daily_limit' as const };
        }

        if (totalUsage + estimatedUsd > this.totalBudgetUsd) {
          return { reserved: false, reason: 'total_limit' as const };
        }

        // Create reservation record
        const record = await tx.aiUsageLedger.create({
          data: {
            day: today,
            model,
            reservedUsd: new Prisma.Decimal(estimatedUsd),
            actualUsd: new Prisma.Decimal(0),
            inputTokens: 0,
            outputTokens: 0,
            requestId: null,
          },
        });

        this.logger.log({
          msg: 'Budget reserved',
          reservationId: record.id,
          estimatedUsd,
          model,
          dailyRemaining: this.dailyBudgetUsd - dailyUsage - estimatedUsd,
          totalRemaining: this.totalBudgetUsd - totalUsage - estimatedUsd,
        });

        return {
          reserved: true,
          reservationId: record.id,
        };
      });
    } catch (error) {
      this.logger.error({ err: error, msg: 'Budget reservation failed' });
      return { reserved: false, reason: 'daily_limit' };
    }
  }

  /**
   * Reconcile reservation with actual usage after API call
   */
  async reconcile(request: ReconcileRequest): Promise<void> {
    try {
      await this.prisma.aiUsageLedger.update({
        where: { id: request.reservationId },
        data: {
          actualUsd: new Prisma.Decimal(request.actualUsd),
          inputTokens: request.inputTokens,
          outputTokens: request.outputTokens,
          requestId: request.requestId,
        },
      });

      this.logger.log({
        msg: 'Budget reconciled',
        reservationId: request.reservationId,
        actualUsd: request.actualUsd,
        model: request.model,
      });
    } catch (error) {
      this.logger.error({
        err: error,
        msg: 'Budget reconciliation failed',
        reservationId: request.reservationId,
      });
    }
  }

  /**
   * Get current usage statistics
   */
  async getUsage(): Promise<{
    dailyUsed: number;
    dailyLimit: number;
    totalUsed: number;
    totalLimit: number;
  }> {
    const today = this.getToday();
    const [dailyUsed, totalUsed] = await Promise.all([
      this.getDailyUsage(today),
      this.getTotalUsage(),
    ]);

    return {
      dailyUsed,
      dailyLimit: this.dailyBudgetUsd,
      totalUsed,
      totalLimit: this.totalBudgetUsd,
    };
  }

  private async getDailyUsage(
    day: Date,
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const client = tx ?? this.prisma;

    const result = await client.aiUsageLedger.aggregate({
      where: { day },
      _sum: { actualUsd: true },
    });

    return Number(result._sum.actualUsd ?? 0);
  }

  private async getTotalUsage(tx?: Prisma.TransactionClient): Promise<number> {
    const client = tx ?? this.prisma;

    const result = await client.aiUsageLedger.aggregate({
      _sum: { actualUsd: true },
    });

    return Number(result._sum.actualUsd ?? 0);
  }

  private getToday(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  private getLockKey(day: Date): number {
    // Convert date to integer key for pg_advisory_lock
    // Use YYYYMMDD format as lock key
    const year = day.getUTCFullYear();
    const month = day.getUTCMonth() + 1;
    const dayOfMonth = day.getUTCDate();
    return year * 10000 + month * 100 + dayOfMonth;
  }
}

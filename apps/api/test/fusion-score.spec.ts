/**
 * Fusion Score Test
 * Work Package D - Signal Fusion
 * 
 * Tests deterministic fusion scoring algorithm
 */

import { Test, TestingModule } from '@nestjs/testing';
import { FusionService } from '../src/ai/fusion/fusion.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { MetaModelClient } from '../src/ai/meta-model-client';
import { BudgetGuardService } from '../src/ai/budget-guard.service';

describe('FusionService - Deterministic Scoring', () => {
  let service: FusionService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FusionService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: MetaModelClient,
          useValue: {},
        },
        {
          provide: BudgetGuardService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<FusionService>(FusionService);
  });

  it('should give high score for nearby, same-type, similar-time incidents', () => {
    const params = {
      incidentAId: 'a',
      incidentBId: 'b',
      sosTypeA: 'TRAPPED',
      sosTypeB: 'TRAPPED',
      latA: 39.9334,
      lonA: 32.8597,
      latB: 39.9340,
      lonB: 32.8600,
      receivedAtA: new Date('2024-01-01T12:00:00Z'),
      receivedAtB: new Date('2024-01-01T12:05:00Z'),
      needsA: ['rescue', 'medical'],
      needsB: ['rescue', 'medical'],
      hazardsA: ['collapse'],
      hazardsB: ['collapse', 'fire'],
      personCountA: 3,
      personCountB: 2,
    };

    const { score, signals } = service.computeDeterministicScore(params);

    expect(score).toBeGreaterThan(0.5);
    expect(signals.locationProximity).toBe(true);
    expect(signals.timeProximity).toBe(true);
    expect(signals.sosTypeMatch).toBe(true);
    expect(signals.distanceMeters).toBeLessThan(1000);
    expect(signals.timeDeltaSeconds).toBe(300);
  });

  it('should give low score for distant incidents', () => {
    const params = {
      incidentAId: 'a',
      incidentBId: 'b',
      sosTypeA: 'TRAPPED',
      sosTypeB: 'TRAPPED',
      latA: 39.9334,
      lonA: 32.8597,
      latB: 40.0334,
      lonB: 33.0597,
      receivedAtA: new Date('2024-01-01T12:00:00Z'),
      receivedAtB: new Date('2024-01-01T12:05:00Z'),
      needsA: ['rescue'],
      needsB: ['rescue'],
      hazardsA: [],
      hazardsB: [],
      personCountA: 3,
      personCountB: 2,
    };

    const { score, signals } = service.computeDeterministicScore(params);

    expect(score).toBeLessThan(0.5);
    expect(signals.locationProximity).toBe(false);
    expect(signals.distanceMeters).toBeGreaterThan(10000);
  });

  it('should give low score for different event types far apart in time', () => {
    const params = {
      incidentAId: 'a',
      incidentBId: 'b',
      sosTypeA: 'FIRE',
      sosTypeB: 'MEDICAL',
      latA: 39.9334,
      lonA: 32.8597,
      latB: 39.9340,
      lonB: 32.8600,
      receivedAtA: new Date('2024-01-01T12:00:00Z'),
      receivedAtB: new Date('2024-01-01T14:00:00Z'),
      needsA: ['fire'],
      needsB: ['medical'],
      hazardsA: [],
      hazardsB: [],
      personCountA: null,
      personCountB: 1,
    };

    const { score, signals } = service.computeDeterministicScore(params);

    expect(score).toBeLessThan(0.5);
    expect(signals.sosTypeMatch).toBe(false);
    expect(signals.timeProximity).toBe(false);
  });

  it('should handle missing location data gracefully', () => {
    const params = {
      incidentAId: 'a',
      incidentBId: 'b',
      sosTypeA: 'GENERAL',
      sosTypeB: 'GENERAL',
      latA: null,
      lonA: null,
      latB: null,
      lonB: null,
      receivedAtA: new Date('2024-01-01T12:00:00Z'),
      receivedAtB: new Date('2024-01-01T12:01:00Z'),
      needsA: ['water', 'food'],
      needsB: ['water', 'food'],
      hazardsA: [],
      hazardsB: [],
      personCountA: 5,
      personCountB: 4,
    };

    const { signals } = service.computeDeterministicScore(params);

    expect(signals.distanceMeters).toBeNull();
    expect(signals.locationProximity).toBe(false);
    expect(signals.timeProximity).toBe(true);
    expect(signals.tokenOverlap).toBeGreaterThan(0);
  });

  it('should compute token overlap correctly', () => {
    const params = {
      incidentAId: 'a',
      incidentBId: 'b',
      sosTypeA: 'TRAPPED',
      sosTypeB: 'TRAPPED',
      latA: 39.9334,
      lonA: 32.8597,
      latB: 39.9340,
      lonB: 32.8600,
      receivedAtA: new Date('2024-01-01T12:00:00Z'),
      receivedAtB: new Date('2024-01-01T12:02:00Z'),
      needsA: ['rescue', 'medical', 'food'],
      needsB: ['rescue', 'water'],
      hazardsA: ['collapse', 'fire'],
      hazardsB: ['collapse'],
      personCountA: 3,
      personCountB: 3,
    };

    const { signals } = service.computeDeterministicScore(params);

    expect(signals.tokenOverlap).toBeGreaterThan(0);
  });
});

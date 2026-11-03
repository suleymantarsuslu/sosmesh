/**
 * Fusion Confirm Test
 * Work Package D - Signal Fusion
 * 
 * Ensures that confirming a link suggestion does NOT auto-merge incidents
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { OperatorModule } from '../src/operator/operator.module';
import { AiModule } from '../src/ai/ai.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import * as request from 'supertest';

describe('Fusion - Confirm Does Not Auto-Merge', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule, AiModule, OperatorModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    const testUser = await prisma.user.upsert({
      where: { email: 'test-fusion@example.com' },
      update: {},
      create: {
        email: 'test-fusion@example.com',
        displayName: 'Test Fusion User',
        passwordHash: 'test',
        role: 'OPERATOR',
      },
    });

    authToken = `test-token-${testUser.id}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('confirming a link suggestion marks it confirmed but does NOT merge incidents', async () => {
    const incidentA = await prisma.incident.create({
      data: {
        state: 'PENDING',
        sosMessages: {
          create: {
            messageId: `test-fusion-a-${Date.now()}`,
            sosType: 'TRAPPED',
            operatorDisplayText: 'Test incident A',
            synthetic: true,
          },
        },
      },
    });

    const incidentB = await prisma.incident.create({
      data: {
        state: 'PENDING',
        sosMessages: {
          create: {
            messageId: `test-fusion-b-${Date.now()}`,
            sosType: 'TRAPPED',
            operatorDisplayText: 'Test incident B',
            synthetic: true,
          },
        },
      },
    });

    const suggestion = await prisma.incidentLinkSuggestion.create({
      data: {
        incidentAId: incidentA.id,
        incidentBId: incidentB.id,
        score: 0.85,
        deterministicSignals: {
          distanceMeters: 100,
          timeDeltaSeconds: 60,
          locationProximity: true,
          timeProximity: true,
          sosTypeMatch: true,
          tokenOverlap: 0.8,
        },
        aiRationale: 'Test rationale',
        status: 'suggested',
      },
    });

    const response = await request(app.getHttpServer())
      .post(`/v1/operator/link-suggestions/${suggestion.id}/confirm`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.status).toBe('confirmed');

    const updatedSuggestion = await prisma.incidentLinkSuggestion.findUnique({
      where: { id: suggestion.id },
    });

    expect(updatedSuggestion?.status).toBe('confirmed');
    expect(updatedSuggestion?.decidedByUserId).toBeTruthy();
    expect(updatedSuggestion?.decidedAt).toBeTruthy();

    const stillExistsA = await prisma.incident.findUnique({
      where: { id: incidentA.id },
    });
    const stillExistsB = await prisma.incident.findUnique({
      where: { id: incidentB.id },
    });

    expect(stillExistsA).toBeTruthy();
    expect(stillExistsB).toBeTruthy();
    expect(stillExistsA?.id).toBe(incidentA.id);
    expect(stillExistsB?.id).toBe(incidentB.id);

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'incident_link_suggestion',
        entityId: suggestion.id,
      },
    });

    expect(auditLogs.length).toBeGreaterThan(0);
    expect(auditLogs.some((log) => log.action === 'link_suggestion_confirmed')).toBe(
      true
    );

    await prisma.auditLog.deleteMany({
      where: { entityType: 'incident_link_suggestion', entityId: suggestion.id },
    });
    await prisma.incidentLinkSuggestion.delete({ where: { id: suggestion.id } });
    await prisma.incident.delete({ where: { id: incidentA.id } });
    await prisma.incident.delete({ where: { id: incidentB.id } });
  });
});

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Teams and Resources CRUD (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let coordinatorCookie: string;
  let operatorCookie: string;
  let organizationId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    const org = await prisma.organization.create({
      data: { name: 'Test Org', slug: 'test-org-crud' },
    });
    organizationId = org.id;

    const team = await prisma.team.create({
      data: {
        name: 'Test Team',
        organizationId,
      },
    });

    const coordinator = await prisma.user.create({
      data: {
        email: 'coordinator@test.local',
        displayName: 'Coordinator',
        role: 'COORDINATOR',
        teamId: team.id,
        passwordHash: '$2b$10$test',
      },
    });

    const operator = await prisma.user.create({
      data: {
        email: 'operator@test.local',
        displayName: 'Operator',
        role: 'OPERATOR',
        teamId: team.id,
        passwordHash: '$2b$10$test',
      },
    });

    coordinatorCookie = `auth_token=coordinator-token-${coordinator.id}`;
    operatorCookie = `auth_token=operator-token-${operator.id}`;
  });

  afterAll(async () => {
    await prisma.team.deleteMany({ where: { organizationId } });
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await app.close();
  });

  describe('POST /v1/operator/teams', () => {
    it('should create a team when user is coordinator', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/operator/teams')
        .set('Cookie', coordinatorCookie)
        .send({
          name: 'New Team',
          type: 'MEDICAL',
          capacity: 10,
          contactInfo: 'radio-123',
          status: 'ACTIVE',
          zoneCode: 'Z1',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'New Team',
        type: 'MEDICAL',
        capacity: 10,
        contactInfo: 'radio-123',
        status: 'ACTIVE',
        zoneCode: 'Z1',
      });

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'team.create' },
        orderBy: { createdAt: 'desc' },
      });
      expect(audit).toBeTruthy();
      expect(audit?.detailsJson).toMatchObject({
        after: { name: 'New Team', type: 'MEDICAL', status: 'ACTIVE' },
      });
    });

    it('should return 403 when user is operator', async () => {
      await request(app.getHttpServer())
        .post('/v1/operator/teams')
        .set('Cookie', operatorCookie)
        .send({
          name: 'Should Fail',
          status: 'ACTIVE',
        })
        .expect(403);
    });

    it('should validate required fields', async () => {
      await request(app.getHttpServer())
        .post('/v1/operator/teams')
        .set('Cookie', coordinatorCookie)
        .send({})
        .expect(400);
    });
  });

  describe('PATCH /v1/operator/teams/:id', () => {
    it('should update a team when user is coordinator', async () => {
      const team = await prisma.team.create({
        data: {
          name: 'Team to Update',
          organizationId,
          status: 'ACTIVE',
        },
      });

      const response = await request(app.getHttpServer())
        .patch(`/v1/operator/teams/${team.id}`)
        .set('Cookie', coordinatorCookie)
        .send({
          name: 'Updated Team Name',
          status: 'STANDBY',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        name: 'Updated Team Name',
        status: 'STANDBY',
      });

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'team.update' },
        orderBy: { createdAt: 'desc' },
      });
      expect(audit).toBeTruthy();
    });

    it('should return 403 when user is operator', async () => {
      const team = await prisma.team.create({
        data: {
          name: 'Team No Access',
          organizationId,
        },
      });

      await request(app.getHttpServer())
        .patch(`/v1/operator/teams/${team.id}`)
        .set('Cookie', operatorCookie)
        .send({ name: 'Should Fail' })
        .expect(403);
    });
  });

  describe('PATCH /v1/operator/resources/:id', () => {
    it('should update a resource when user is coordinator', async () => {
      const resource = await prisma.resource.create({
        data: {
          name: 'Resource to Update',
          kind: 'VEHICLE',
          capacity: 1,
          organizationId,
        },
      });

      const response = await request(app.getHttpServer())
        .patch(`/v1/operator/resources/${resource.id}`)
        .set('Cookie', coordinatorCookie)
        .send({
          name: 'Updated Resource',
          isActive: false,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        name: 'Updated Resource',
        isActive: false,
      });

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'resource.update' },
        orderBy: { createdAt: 'desc' },
      });
      expect(audit).toBeTruthy();
    });

    it('should return 403 when user is operator', async () => {
      const resource = await prisma.resource.create({
        data: {
          name: 'Resource No Access',
          kind: 'EQUIPMENT',
          capacity: 1,
          organizationId,
        },
      });

      await request(app.getHttpServer())
        .patch(`/v1/operator/resources/${resource.id}`)
        .set('Cookie', operatorCookie)
        .send({ name: 'Should Fail' })
        .expect(403);
    });
  });
});

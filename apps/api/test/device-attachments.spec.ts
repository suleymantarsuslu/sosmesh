/**
 * Device Attachments E2E Test
 * 
 * Tests device-facing media upload with upload token auth
 */

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { DeviceUploadTokenService } from '../src/media/device-upload-token.service';

describe('Device Attachments (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenService: DeviceUploadTokenService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    tokenService = app.get(DeviceUploadTokenService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /v1/device/attachments', () => {
    it('should reject upload without token', async () => {
      const buffer = Buffer.from('fake audio data');
      
      const response = await request(app.getHttpServer())
        .post('/v1/device/attachments')
        .field('kind', 'audio')
        .attach('file', buffer, { filename: 'test.mp3', contentType: 'audio/mpeg' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('x-upload-token');
    });

    it('should reject upload with invalid token', async () => {
      const buffer = Buffer.from('fake audio data');
      
      const response = await request(app.getHttpServer())
        .post('/v1/device/attachments')
        .set('x-upload-token', 'invalid:token')
        .field('kind', 'audio')
        .attach('file', buffer, { filename: 'test.mp3', contentType: 'audio/mpeg' });

      expect(response.status).toBe(404);
    });

    it('should reject file exceeding size limit', async () => {
      const incident = await prisma.incident.create({
        data: { state: 'PENDING' },
      });

      const message = await prisma.sosMessage.create({
        data: {
          messageId: 'msg-size-test',
          incidentId: incident.id,
          deliveryState: 'SERVER_ACCEPTED',
          locationStatus: 'unknown',
          priority: 3,
          packetHash: 'a'.repeat(64),
        },
      });

      const token = tokenService.generateToken(message.messageId, message.packetHash!);
      const largeBuffer = Buffer.alloc(60 * 1024 * 1024);

      const response = await request(app.getHttpServer())
        .post('/v1/device/attachments')
        .set('x-upload-token', token)
        .field('kind', 'audio')
        .attach('file', largeBuffer, { filename: 'large.mp3', contentType: 'audio/mpeg' });

      expect(response.status).toBe(413);
    });

    it('should accept valid audio upload with correct token', async () => {
      const incident = await prisma.incident.create({
        data: { state: 'PENDING' },
      });

      const message = await prisma.sosMessage.create({
        data: {
          messageId: 'msg-audio-upload',
          incidentId: incident.id,
          deliveryState: 'SERVER_ACCEPTED',
          locationStatus: 'unknown',
          priority: 3,
          packetHash: 'b'.repeat(64),
        },
      });

      const token = tokenService.generateToken(message.messageId, message.packetHash!);
      const audioBuffer = Buffer.from('RIFF....WAVEfmt ');

      const response = await request(app.getHttpServer())
        .post('/v1/device/attachments')
        .set('x-upload-token', token)
        .field('kind', 'audio')
        .attach('file', audioBuffer, { filename: 'voice.wav', contentType: 'audio/wav' });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('attachmentId');
      expect(response.body).toHaveProperty('sha256');
    });

    it('should reject token for different message', async () => {
      const incident = await prisma.incident.create({
        data: { state: 'PENDING' },
      });

      const message1 = await prisma.sosMessage.create({
        data: {
          messageId: 'msg-1',
          incidentId: incident.id,
          deliveryState: 'SERVER_ACCEPTED',
          locationStatus: 'unknown',
          priority: 3,
          packetHash: 'c'.repeat(64),
        },
      });

      const message2 = await prisma.sosMessage.create({
        data: {
          messageId: 'msg-2',
          incidentId: incident.id,
          deliveryState: 'SERVER_ACCEPTED',
          locationStatus: 'unknown',
          priority: 3,
          packetHash: 'd'.repeat(64),
        },
      });

      const token1 = tokenService.generateToken(message1.messageId, message1.packetHash!);
      const buffer = Buffer.from('fake data');

      const response = await request(app.getHttpServer())
        .post('/v1/device/attachments')
        .set('x-upload-token', `msg-2:${token1.split(':')[1]}`)
        .field('kind', 'audio')
        .attach('file', buffer, { filename: 'test.mp3', contentType: 'audio/mpeg' });

      expect(response.status).toBe(401);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BroadcastSignerService } from './broadcast-signer.service';
import { generateKeyPairSync } from 'node:crypto';

describe('BroadcastSignerService', () => {
  let service: BroadcastSignerService;
  let testPrivateKey: string;

  beforeEach(async () => {
    const keyPair = generateKeyPairSync('ed25519', {
      privateKeyEncoding: { type: 'pkcs8', format: 'der' },
      publicKeyEncoding: { type: 'spki', format: 'der' },
    });
    testPrivateKey = Buffer.from(keyPair.privateKey as Buffer).toString('base64');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BroadcastSignerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'INGEST_RECEIPT_SIGNING_PRIVATE_KEY') {
                return testPrivateKey;
              }
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<BroadcastSignerService>(BroadcastSignerService);
    service.onModuleInit();
  });

  it('should sign broadcast without region', () => {
    const signature = service.signBroadcast(
      'test-id',
      'Test Title',
      'Test Body',
      'info',
      new Date('2026-11-04T12:00:00Z'),
      new Date('2026-11-05T12:00:00Z')
    );

    expect(signature).toBeTruthy();
    expect(typeof signature).toBe('string');
  });

  it('should sign broadcast with region', () => {
    const signature = service.signBroadcast(
      'test-id',
      'Test Title',
      'Test Body',
      'warning',
      new Date('2026-11-04T12:00:00Z'),
      new Date('2026-11-05T12:00:00Z'),
      40.7128,
      -74.0060,
      50
    );

    expect(signature).toBeTruthy();
    expect(typeof signature).toBe('string');
  });

  it('should verify valid signature without region', () => {
    const id = 'test-id';
    const title = 'Test Title';
    const body = 'Test Body';
    const severity = 'info';
    const createdAt = new Date('2026-11-04T12:00:00Z');
    const expiresAt = new Date('2026-11-05T12:00:00Z');

    const signature = service.signBroadcast(id, title, body, severity, createdAt, expiresAt);

    const isValid = service.verifyBroadcast(
      id,
      title,
      body,
      severity,
      createdAt.toISOString(),
      expiresAt.toISOString(),
      signature
    );

    expect(isValid).toBe(true);
  });

  it('should verify valid signature with region', () => {
    const id = 'test-id';
    const title = 'Test Title';
    const body = 'Test Body';
    const severity = 'warning';
    const createdAt = new Date('2026-11-04T12:00:00Z');
    const expiresAt = new Date('2026-11-05T12:00:00Z');
    const lat = 40.7128;
    const lng = -74.0060;
    const radiusKm = 50;

    const signature = service.signBroadcast(id, title, body, severity, createdAt, expiresAt, lat, lng, radiusKm);

    const isValid = service.verifyBroadcast(
      id,
      title,
      body,
      severity,
      createdAt.toISOString(),
      expiresAt.toISOString(),
      signature,
      lat,
      lng,
      radiusKm
    );

    expect(isValid).toBe(true);
  });

  it('should reject tampered broadcast', () => {
    const signature = service.signBroadcast(
      'test-id',
      'Test Title',
      'Test Body',
      'info',
      new Date('2026-11-04T12:00:00Z'),
      new Date('2026-11-05T12:00:00Z')
    );

    const isValid = service.verifyBroadcast(
      'test-id',
      'Tampered Title',
      'Test Body',
      'info',
      '2026-11-04T12:00:00.000Z',
      '2026-11-05T12:00:00.000Z',
      signature
    );

    expect(isValid).toBe(false);
  });
});

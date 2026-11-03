import { Test, TestingModule } from '@nestjs/testing';
import { ServerKeyPlaintextSource } from './sos-plaintext-source';
import { PrismaService } from '../prisma/prisma.service';
import { encryptPayload, decryptPayload, canonicalJSON } from '@sosmesh/contracts';

describe('ServerKeyPlaintextSource - Envelope AAD', () => {
  let service: ServerKeyPlaintextSource;
  let prismaService: PrismaService;

  const testConfig = {
    keyId: 'test-key-001',
    serverPublicKey: 'M8tCMh3Xzp8jG6F2K7JvnX1A9cD3LqZwE5Y4bT8mN0Q=',
    serverPrivateKey: 'OHV0FGQrp8sJ9x5Ew2Z3T6K7bN1A8cD4G5mF9qY0Lz8=',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServerKeyPlaintextSource,
        {
          provide: PrismaService,
          useValue: {
            sosMessage: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    process.env.SOSMESH_SERVER_SOS_PRIVATE_KEY = testConfig.serverPrivateKey;
    process.env.SOSMESH_SERVER_SOS_KEY_ID = testConfig.keyId;

    service = module.get<ServerKeyPlaintextSource>(ServerKeyPlaintextSource);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    delete process.env.SOSMESH_SERVER_SOS_PRIVATE_KEY;
    delete process.env.SOSMESH_SERVER_SOS_KEY_ID;
  });

  it('should decrypt with original envelope AAD matching iOS encryption', async () => {
    const envelope = {
      timestamp: '2026-11-03T10:00:00.000Z',
      locationStatus: 'UNKNOWN',
      location: null,
      priority: 1,
    };

    const payload = {
      sos_type: 'GENERAL',
      note: 'Help! I need assistance.',
      language: 'en',
    };

    const encrypted = encryptPayload(payload, envelope, testConfig);
    const originalEnvelopeAad = canonicalJSON(envelope);

    jest.spyOn(prismaService.sosMessage, 'findUnique').mockResolvedValue({
      id: 'msg-1',
      noteText: null,
      encryptedNoteBlob: JSON.stringify(encrypted),
      synthetic: false,
      latitude: null,
      longitude: null,
      locationStatus: 'UNKNOWN',
      originalEnvelopeAad,
    } as any);

    jest.spyOn(prismaService.sosMessage, 'update').mockResolvedValue({} as any);

    const result = await service.getPlaintext({
      incidentId: 'incident-1',
      messageId: 'msg-1',
    });

    expect(result).toBe('Help! I need assistance.');
  });

  it('should fall back to legacy reconstruction when originalEnvelopeAad is missing', async () => {
    const envelope = {
      locationStatus: 'UNKNOWN',
    };

    const payload = {
      sos_type: 'GENERAL',
      note: 'Legacy message',
      language: 'en',
    };

    const encrypted = encryptPayload(payload, envelope, testConfig);

    jest.spyOn(prismaService.sosMessage, 'findUnique').mockResolvedValue({
      id: 'msg-1',
      noteText: null,
      encryptedNoteBlob: JSON.stringify(encrypted),
      synthetic: false,
      latitude: null,
      longitude: null,
      locationStatus: 'UNKNOWN',
      originalEnvelopeAad: null,
    } as any);

    jest.spyOn(prismaService.sosMessage, 'update').mockResolvedValue({} as any);

    const result = await service.getPlaintext({
      incidentId: 'incident-1',
      messageId: 'msg-1',
    });

    expect(result).toBe('Legacy message');
  });

  it('should fail decryption when AAD does not match', async () => {
    const correctEnvelope = {
      timestamp: '2026-11-03T10:00:00.000Z',
      locationStatus: 'UNKNOWN',
      location: null,
      priority: 1,
    };

    const wrongEnvelope = {
      locationStatus: 'GPS',
      location: {
        latitude: 41.0082,
        longitude: 28.9784,
      },
    };

    const payload = {
      sos_type: 'GENERAL',
      note: 'This should fail',
      language: 'en',
    };

    const encrypted = encryptPayload(payload, correctEnvelope, testConfig);
    const wrongEnvelopeAad = canonicalJSON(wrongEnvelope);

    jest.spyOn(prismaService.sosMessage, 'findUnique').mockResolvedValue({
      id: 'msg-1',
      noteText: null,
      encryptedNoteBlob: JSON.stringify(encrypted),
      synthetic: false,
      latitude: 41.0082,
      longitude: 28.9784,
      locationStatus: 'GPS',
      originalEnvelopeAad: wrongEnvelopeAad,
    } as any);

    const result = await service.getPlaintext({
      incidentId: 'incident-1',
      messageId: 'msg-1',
    });

    expect(result).toBeNull();
  });

  it('should handle GPS location in envelope AAD', async () => {
    const envelope = {
      timestamp: '2026-11-03T10:00:00.000Z',
      locationStatus: 'GPS',
      location: {
        latitude: 41.0082,
        longitude: 28.9784,
      },
      priority: 2,
    };

    const payload = {
      sos_type: 'MEDICAL',
      note: 'Medical emergency with GPS',
      language: 'en',
    };

    const encrypted = encryptPayload(payload, envelope, testConfig);
    const originalEnvelopeAad = canonicalJSON(envelope);

    jest.spyOn(prismaService.sosMessage, 'findUnique').mockResolvedValue({
      id: 'msg-1',
      noteText: null,
      encryptedNoteBlob: JSON.stringify(encrypted),
      synthetic: false,
      latitude: 41.0082,
      longitude: 28.9784,
      locationStatus: 'GPS',
      originalEnvelopeAad,
    } as any);

    jest.spyOn(prismaService.sosMessage, 'update').mockResolvedValue({} as any);

    const result = await service.getPlaintext({
      incidentId: 'incident-1',
      messageId: 'msg-1',
    });

    expect(result).toBe('Medical emergency with GPS');
  });
});

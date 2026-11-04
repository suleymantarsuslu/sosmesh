import { Test, TestingModule } from '@nestjs/testing';
import { BroadcastService } from './broadcast.service';
import { PrismaService } from '../prisma/prisma.service';
import { BroadcastSignerService } from './broadcast-signer.service';
import { StructuredEventLogger } from '../observability/structured-event-logger.service';
import { BadRequestException } from '@nestjs/common';

describe('BroadcastService', () => {
  let service: BroadcastService;
  let prisma: jest.Mocked<PrismaService>;
  let signer: jest.Mocked<BroadcastSignerService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BroadcastService,
        {
          provide: PrismaService,
          useValue: {
            broadcastNotification: {
              create: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: BroadcastSignerService,
          useValue: {
            signBroadcast: jest.fn().mockReturnValue('test-signature'),
          },
        },
        {
          provide: StructuredEventLogger,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BroadcastService>(BroadcastService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    signer = module.get(BroadcastSignerService) as jest.Mocked<BroadcastSignerService>;
  });

  it('should create broadcast without region', async () => {
    const userId = 'test-user-id';
    const dto = {
      title: 'Test Alert',
      body: 'This is a test',
      severity: 'info',
      expiryHours: 24,
    };

    const mockBroadcast = {
      id: 'test-id',
      title: dto.title,
      body: dto.body,
      severity: dto.severity,
      createdById: userId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      regionLatitude: null,
      regionLongitude: null,
      regionRadiusKm: null,
      signature: 'test-signature',
      deliveredCount: 0,
      meshRelayCount: 0,
    };

    (prisma.broadcastNotification.create as jest.Mock).mockResolvedValue(mockBroadcast as any);

    const result = await service.create(userId, dto as any);

    expect(result.id).toBe('test-id');
    expect(result.title).toBe(dto.title);
    expect(result.regionLatitude).toBeNull();
    expect(signer.signBroadcast).toHaveBeenCalled();
  });

  it('should create broadcast with region', async () => {
    const userId = 'test-user-id';
    const dto = {
      title: 'Regional Alert',
      body: 'This is a regional test',
      severity: 'warning',
      expiryHours: 48,
      regionLatitude: 40.7128,
      regionLongitude: -74.0060,
      regionRadiusKm: 50,
    };

    const mockBroadcast = {
      id: 'test-id',
      title: dto.title,
      body: dto.body,
      severity: dto.severity,
      createdById: userId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      regionLatitude: { toNumber: () => dto.regionLatitude },
      regionLongitude: { toNumber: () => dto.regionLongitude },
      regionRadiusKm: dto.regionRadiusKm,
      signature: 'test-signature',
      deliveredCount: 0,
      meshRelayCount: 0,
    };

    (prisma.broadcastNotification.create as jest.Mock).mockResolvedValue(mockBroadcast as any);

    const result = await service.create(userId, dto as any);

    expect(result.regionLatitude).toBe(dto.regionLatitude);
    expect(result.regionLongitude).toBe(dto.regionLongitude);
    expect(result.regionRadiusKm).toBe(dto.regionRadiusKm);
  });

  it('should reject partial region data', async () => {
    const userId = 'test-user-id';
    const dto: any = {
      title: 'Bad Regional Alert',
      body: 'Missing radius',
      severity: 'info',
      expiryHours: 24,
      regionLatitude: 40.7128,
      regionLongitude: -74.0060,
    };

    await expect(service.create(userId, dto)).rejects.toThrow(BadRequestException);
  });

  it('should list only active broadcasts', async () => {
    const now = new Date();
    const future = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const mockBroadcasts = [
      {
        id: 'active-1',
        title: 'Active Alert',
        body: 'Still valid',
        severity: 'info',
        createdAt: now,
        expiresAt: future,
        regionLatitude: null,
        regionLongitude: null,
        regionRadiusKm: null,
        signature: 'sig1',
        deliveredCount: 5,
        meshRelayCount: 2,
      },
    ];

    (prisma.broadcastNotification.findMany as jest.Mock).mockResolvedValue(mockBroadcasts as any);

    const result = await service.listActive(new Date(now.getTime() - 3600000));

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('active-1');
  });
});

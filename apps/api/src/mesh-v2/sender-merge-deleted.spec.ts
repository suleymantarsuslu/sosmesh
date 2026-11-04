import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { MeshV2IngestService } from './mesh-v2-ingest.service';
import { IncidentState } from '@prisma/client';

describe('Mesh v2 sender merge with deleted incidents', () => {
  let service: MeshV2IngestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeshV2IngestService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<MeshV2IngestService>(MeshV2IngestService);
  });

  const mockTx = {
    $executeRaw: jest.fn(),
    incident: {
      findFirst: jest.fn(),
    },
  };

  it('should exclude soft-deleted incidents from merge target', async () => {
    const senderId = 'sender-1';
    const now = new Date();

    await service.findMergeTarget(mockTx as any, senderId, now);

    expect(mockTx.incident.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          senderId,
          deletedAt: null,
          state: { in: [IncidentState.PENDING, IncidentState.ASSIGNED, IncidentState.IN_PROGRESS] },
        }),
      })
    );
  });

  it('should return null when only deleted incident exists for sender', async () => {
    const senderId = 'sender-1';
    const now = new Date();

    mockTx.incident.findFirst.mockResolvedValue(null);

    const result = await service.findMergeTarget(mockTx as any, senderId, now);

    expect(result).toBeNull();
  });
});

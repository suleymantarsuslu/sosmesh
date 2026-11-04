import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { RelayDeliveryStatusService } from './relay-delivery-status.service';

describe('RelayDeliveryStatusService', () => {
  let service: RelayDeliveryStatusService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RelayDeliveryStatusService,
        {
          provide: PrismaService,
          useValue: {
            sosMessage: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<RelayDeliveryStatusService>(RelayDeliveryStatusService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkDeliveryStatus', () => {
    it('should return empty array when no message IDs provided', async () => {
      const result = await service.checkDeliveryStatus([]);
      expect(result.delivered).toEqual([]);
      expect(prisma.sosMessage.findMany).not.toHaveBeenCalled();
    });

    it('should return delivered message IDs', async () => {
      const messageIds = ['msg1', 'msg2', 'msg3'];
      const mockMessages = [
        { messageId: 'msg1' },
        { messageId: 'msg3' },
      ];

      (prisma.sosMessage.findMany as jest.Mock).mockResolvedValue(mockMessages);

      const result = await service.checkDeliveryStatus(messageIds);

      expect(result.delivered).toEqual(['msg1', 'msg3']);
      expect(prisma.sosMessage.findMany).toHaveBeenCalledWith({
        where: {
          messageId: {
            in: messageIds,
          },
        },
        select: {
          messageId: true,
        },
      });
    });

    it('should deduplicate message IDs before querying', async () => {
      const messageIds = ['msg1', 'msg1', 'msg2'];
      const mockMessages = [{ messageId: 'msg1' }, { messageId: 'msg2' }];

      (prisma.sosMessage.findMany as jest.Mock).mockResolvedValue(mockMessages);

      const result = await service.checkDeliveryStatus(messageIds);

      expect(result.delivered).toEqual(['msg1', 'msg2']);
      expect(prisma.sosMessage.findMany).toHaveBeenCalledWith({
        where: {
          messageId: {
            in: ['msg1', 'msg2'],
          },
        },
        select: {
          messageId: true,
        },
      });
    });

    it('should handle database errors gracefully', async () => {
      const messageIds = ['msg1'];
      (prisma.sosMessage.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.checkDeliveryStatus(messageIds)).rejects.toThrow('Database error');
    });
  });
});

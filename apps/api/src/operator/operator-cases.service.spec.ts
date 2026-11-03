import { Test } from '@nestjs/testing';
import { OperatorCasesService } from './operator-cases.service';
import { PrismaService } from '../prisma/prisma.service';
import { IncidentScopeService } from '../organization/incident-scope.service';

describe('OperatorCasesService', () => {
  let service: OperatorCasesService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OperatorCasesService,
        {
          provide: PrismaService,
          useValue: {
            sosMessage: {
              findFirst: jest.fn(),
            },
            aiAnalysis: {
              findFirst: jest.fn(),
            },
            attachment: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: IncidentScopeService,
          useValue: {
            canAccessIncident: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<OperatorCasesService>(OperatorCasesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getCaseDetail - AI status case-insensitive comparison', () => {
    it('should recognize lowercase "completed" status and include AI suggestion', async () => {
      const mockMessage = {
        id: 'msg-1',
        messageId: 'test-msg',
        incidentId: 'inc-1',
        priority: 1,
        sosType: 'GENERAL',
        deliveryState: 'SERVER_ACCEPTED',
        locationStatus: 'GPS',
        latitude: { toNumber: () => 40.7 },
        longitude: { toNumber: () => 29.5 },
        accuracyMeters: 50,
        preciseLatitude: { toNumber: () => 40.7128 },
        preciseLongitude: { toNumber: () => 29.5456 },
        preciseAccuracyMeters: 10,
        preciseCapturedAt: new Date(),
        receivedAt: new Date(),
        personCount: null,
        operatorDisplayText: 'Test message',
        noteText: null,
        incident: {
          state: 'PENDING',
          version: 1,
          reviewStatus: 'PENDING',
        },
        messageEvents: [],
      };

      const mockAiAnalysis = {
        id: 'ai-1',
        incidentId: 'inc-1',
        status: 'completed', // lowercase as stored in prod
        modelVersion: 'gpt-4',
        resultJson: {
          categories: ['medical'],
          urgency: 'high',
        },
        createdAt: new Date(),
      };

      (prisma.sosMessage.findFirst as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.aiAnalysis.findFirst as jest.Mock).mockResolvedValue(mockAiAnalysis);
      (prisma.attachment.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getCaseDetail(
        { userId: 'user-1', organizationId: 'org-1', teamId: null, role: 'OPERATOR' },
        'inc-1'
      );

      expect(result).not.toBeNull();
      expect(result!.ai).not.toBeNull();
      expect(result!.ai!.suggestion).toEqual({
        categories: ['medical'],
        urgency: 'high',
      });
      expect(result!.ai!.status).toBe('completed');
    });

    it('should recognize uppercase "COMPLETED" status and include AI suggestion', async () => {
      const mockMessage = {
        id: 'msg-1',
        messageId: 'test-msg',
        incidentId: 'inc-1',
        priority: 1,
        sosType: 'GENERAL',
        deliveryState: 'SERVER_ACCEPTED',
        locationStatus: 'GPS',
        latitude: { toNumber: () => 40.7 },
        longitude: { toNumber: () => 29.5 },
        accuracyMeters: 50,
        preciseLatitude: null,
        preciseLongitude: null,
        preciseAccuracyMeters: null,
        preciseCapturedAt: null,
        receivedAt: new Date(),
        personCount: null,
        operatorDisplayText: 'Test message',
        noteText: null,
        incident: {
          state: 'PENDING',
          version: 1,
          reviewStatus: 'PENDING',
        },
        messageEvents: [],
      };

      const mockAiAnalysis = {
        id: 'ai-1',
        incidentId: 'inc-1',
        status: 'COMPLETED', // uppercase
        modelVersion: 'gpt-4',
        resultJson: {
          categories: ['fire'],
          urgency: 'critical',
        },
        createdAt: new Date(),
      };

      (prisma.sosMessage.findFirst as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.aiAnalysis.findFirst as jest.Mock).mockResolvedValue(mockAiAnalysis);
      (prisma.attachment.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getCaseDetail(
        { userId: 'user-1', organizationId: 'org-1', teamId: null, role: 'OPERATOR' },
        'inc-1'
      );

      expect(result).not.toBeNull();
      expect(result!.ai).not.toBeNull();
      expect(result!.ai!.suggestion).toEqual({
        categories: ['fire'],
        urgency: 'critical',
      });
    });

    it('should return null suggestion for pending status', async () => {
      const mockMessage = {
        id: 'msg-1',
        messageId: 'test-msg',
        incidentId: 'inc-1',
        priority: 1,
        sosType: 'GENERAL',
        deliveryState: 'SERVER_ACCEPTED',
        locationStatus: 'GPS',
        latitude: { toNumber: () => 40.7 },
        longitude: { toNumber: () => 29.5 },
        accuracyMeters: 50,
        preciseLatitude: null,
        preciseLongitude: null,
        preciseAccuracyMeters: null,
        preciseCapturedAt: null,
        receivedAt: new Date(),
        personCount: null,
        operatorDisplayText: 'Test message',
        noteText: null,
        incident: {
          state: 'PENDING',
          version: 1,
          reviewStatus: 'PENDING',
        },
        messageEvents: [],
      };

      const mockAiAnalysis = {
        id: 'ai-1',
        incidentId: 'inc-1',
        status: 'pending',
        modelVersion: 'gpt-4',
        resultJson: {},
        createdAt: new Date(),
      };

      (prisma.sosMessage.findFirst as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.aiAnalysis.findFirst as jest.Mock).mockResolvedValue(mockAiAnalysis);
      (prisma.attachment.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getCaseDetail(
        { userId: 'user-1', organizationId: 'org-1', teamId: null, role: 'OPERATOR' },
        'inc-1'
      );

      expect(result).not.toBeNull();
      expect(result!.ai).not.toBeNull();
      expect(result!.ai!.suggestion).toBeNull();
      expect(result!.ai!.status).toBe('pending');
    });
  });

  describe('getCaseDetail - attachments field', () => {
    it('should include attachments with transcript and vision statuses', async () => {
      const mockMessage = {
        id: 'msg-1',
        messageId: 'test-msg',
        incidentId: 'inc-1',
        priority: 1,
        sosType: 'GENERAL',
        deliveryState: 'SERVER_ACCEPTED',
        locationStatus: 'GPS',
        latitude: { toNumber: () => 40.7 },
        longitude: { toNumber: () => 29.5 },
        accuracyMeters: 50,
        preciseLatitude: null,
        preciseLongitude: null,
        preciseAccuracyMeters: null,
        preciseCapturedAt: null,
        receivedAt: new Date(),
        personCount: null,
        operatorDisplayText: 'Test message',
        noteText: null,
        incident: {
          state: 'PENDING',
          version: 1,
          reviewStatus: 'PENDING',
        },
        messageEvents: [],
      };

      const mockAttachments = [
        {
          id: 'att-audio',
          kind: 'audio',
          mime: 'audio/wav',
          sizeBytes: 50000,
          durationMs: 5000,
          createdAt: new Date(),
          transcript: {
            id: 'trans-1',
            status: 'completed',
            model: 'whisper',
            transcript: 'Help me please',
            turns: [],
            language: 'en',
            audioDurationMs: 5000,
            createdAt: new Date(),
          },
          visionAnalysis: null,
        },
        {
          id: 'att-photo',
          kind: 'photo',
          mime: 'image/jpeg',
          sizeBytes: 200000,
          durationMs: null,
          createdAt: new Date(),
          transcript: null,
          visionAnalysis: {
            id: 'vision-1',
            status: 'processing',
            sparkResults: null,
            samResults: null,
          },
        },
      ];

      (prisma.sosMessage.findFirst as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.aiAnalysis.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.attachment.findMany as jest.Mock).mockResolvedValue(mockAttachments);

      const result = await service.getCaseDetail(
        { userId: 'user-1', organizationId: 'org-1', teamId: null, role: 'OPERATOR' },
        'inc-1'
      );

      expect(result).not.toBeNull();
      expect(result!.attachments).toHaveLength(2);
      expect(result!.attachments[0]).toMatchObject({
        id: 'att-audio',
        kind: 'audio',
        mime: 'audio/wav',
        transcriptStatus: 'completed',
        visionStatus: null,
      });
      expect(result!.attachments[1]).toMatchObject({
        id: 'att-photo',
        kind: 'photo',
        mime: 'image/jpeg',
        transcriptStatus: null,
        visionStatus: 'processing',
      });
    });
  });
});

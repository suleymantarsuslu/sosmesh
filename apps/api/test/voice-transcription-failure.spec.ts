/**
 * Voice Transcription Failure Test
 * Work Package B - Voice Rescue
 * 
 * Verify that SOS ingest is unaffected when transcription fails
 */

import { Test } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { VoiceTranscriptionService } from '../src/ai/voice/voice-transcription.service';
import { MetaModelClient } from '../src/ai/meta-model-client';
import { BudgetGuardService } from '../src/ai/budget-guard.service';
import { AudioConversionService } from '../src/media/audio-conversion.service';
import { AiJobQueueService } from '../src/ai/ai-job-queue.service';
import { MEDIA_STORAGE } from '../src/media/media-storage.interface';

describe('Voice Transcription Failure Handling', () => {
  let voiceService: VoiceTranscriptionService;
  let metaClient: MetaModelClient;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        VoiceTranscriptionService,
        {
          provide: PrismaService,
          useValue: {
            attachment: {
              findUnique: jest.fn(),
            },
            sosMessage: {
              findFirst: jest.fn(),
            },
            aiTranscript: {
              create: jest.fn(),
            },
          },
        },
        {
          provide: MetaModelClient,
          useValue: {
            transcribe: jest.fn(),
            computeAsrCost: jest.fn(() => 0.001),
          },
        },
        {
          provide: BudgetGuardService,
          useValue: {
            reserve: jest.fn(() => ({ reserved: true, reservationId: 'test' })),
            reconcile: jest.fn(),
          },
        },
        {
          provide: AudioConversionService,
          useValue: {
            validateDuration: jest.fn(() => 5000),
            convertToWav: jest.fn(() => ({ wavBuffer: Buffer.from(''), durationMs: 5000 })),
          },
        },
        {
          provide: MEDIA_STORAGE,
          useValue: {
            retrieve: jest.fn(() => Buffer.from('')),
          },
        },
        {
          provide: AiJobQueueService,
          useValue: {
            enqueue: jest.fn(() => 'job-123'),
          },
        },
      ],
    }).compile();

    voiceService = module.get(VoiceTranscriptionService);
    metaClient = module.get(MetaModelClient);
    prisma = module.get(PrismaService);
  });

  it('should return unavailable when ASR fails', async () => {
    (prisma.attachment.findUnique as jest.Mock).mockResolvedValue({
      id: 'att-1',
      incidentId: 'inc-1',
      sosMessageId: null,
      kind: 'audio',
      mime: 'audio/wav',
      durationMs: 5000,
      storageKey: 'test.wav',
    });

    (prisma.sosMessage.findFirst as jest.Mock).mockResolvedValue({
      operatorDisplayText: 'Help needed',
    });

    (metaClient.transcribe as jest.Mock).mockResolvedValue({
      ok: false,
      error: 'service_unavailable',
      retryable: true,
    });

    const result = await voiceService.processTranscription('att-1');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe('unavailable');
    }
  });

  it('should handle budget exceeded gracefully', async () => {
    const budgetGuard = Test.createMock<BudgetGuardService>();
    budgetGuard.reserve = jest.fn(() => ({ reserved: false, reason: 'daily_limit' }));

    const moduleWithBudgetLimit = await Test.createTestingModule({
      providers: [
        VoiceTranscriptionService,
        { provide: PrismaService, useValue: prisma },
        { provide: MetaModelClient, useValue: metaClient },
        { provide: BudgetGuardService, useValue: budgetGuard },
        {
          provide: AudioConversionService,
          useValue: {
            validateDuration: jest.fn(() => 5000),
          },
        },
        { provide: MEDIA_STORAGE, useValue: { retrieve: jest.fn() } },
        { provide: AiJobQueueService, useValue: { enqueue: jest.fn() } },
      ],
    }).compile();

    const serviceWithLimit = moduleWithLimit.get(VoiceTranscriptionService);

    (prisma.attachment.findUnique as jest.Mock).mockResolvedValue({
      id: 'att-2',
      incidentId: 'inc-2',
      durationMs: 5000,
      mime: 'audio/wav',
      storageKey: 'test.wav',
    });

    const result = await serviceWithLimit.processTranscription('att-2');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe('budget_exceeded');
    }
  });
});

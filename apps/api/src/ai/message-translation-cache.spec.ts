import { BudgetGuardService } from './budget-guard.service';
import { MessageTranslationService } from './message-translation.service';
import { MetaModelClient } from './meta-model-client';
import { PrismaService } from '../prisma/prisma.service';

describe('MessageTranslationService - same-language verdict is cached and billed', () => {
  const envBefore = process.env.AI_ENABLED;

  beforeAll(() => {
    process.env.AI_ENABLED = 'true';
  });
  afterAll(() => {
    process.env.AI_ENABLED = envBefore;
  });

  function build(cachedRow: { translatedText: string; sourceLanguage: string } | null, modelJson: unknown) {
    const prisma = {
      aiTranslationCache: {
        findFirst: jest.fn().mockResolvedValue(cachedRow),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    const metaClient = {
      sparkModel: 'muse-spark-1.3',
      chatJson: jest.fn().mockResolvedValue({
        ok: true,
        json: modelJson,
        model: 'muse-spark-1.3',
        requestId: 'req-1',
        usage: { inputTokens: 100, outputTokens: 20 },
      }),
      computeCost: jest.fn().mockReturnValue(0.0007),
    };
    const budgetGuard = {
      reserve: jest.fn().mockResolvedValue({ reserved: true, reservationId: 'res-1' }),
      reconcile: jest.fn().mockResolvedValue(undefined),
    };
    const service = new MessageTranslationService(
      prisma as unknown as PrismaService,
      metaClient as unknown as MetaModelClient,
      budgetGuard as unknown as BudgetGuardService
    );
    return { service, prisma, metaClient, budgetGuard };
  }

  it('caches a same-language verdict and reconciles the real cost', async () => {
    const { service, prisma, budgetGuard } = build(null, {
      translated_text: 'Help us',
      detected_language: 'en',
    });

    const result = await service.translateMessage('msg-1', 'Help us', 'en');

    expect(result).toBeNull();
    expect(budgetGuard.reconcile).toHaveBeenCalledWith(
      expect.objectContaining({ reservationId: 'res-1', actualUsd: 0.0007, inputTokens: 100, outputTokens: 20 })
    );
    expect(prisma.aiTranslationCache.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          sourceType_sourceId_sourceField_targetLanguage: {
            sourceType: 'sos_message',
            sourceId: 'msg-1',
            sourceField: 'noteText',
            targetLanguage: 'en',
          },
        },
        create: expect.objectContaining({ sourceLanguage: 'en', targetLanguage: 'en' }),
      })
    );
  });

  it('does not call the model again when a same-language verdict is cached', async () => {
    const { service, metaClient, budgetGuard } = build({ translatedText: 'Help us', sourceLanguage: 'en' }, {});

    const result = await service.translateMessage('msg-1', 'Help us', 'en');

    expect(result).toBeNull();
    expect(metaClient.chatJson).not.toHaveBeenCalled();
    expect(budgetGuard.reserve).not.toHaveBeenCalled();
  });

  it('still returns a cached real translation', async () => {
    const { service, metaClient } = build({ translatedText: 'Help us', sourceLanguage: 'tr' }, {});

    const result = await service.translateMessage('msg-1', 'Yardım edin', 'en');

    expect(result).toEqual({ translatedText: 'Help us', detectedLanguage: 'tr', cached: true });
    expect(metaClient.chatJson).not.toHaveBeenCalled();
  });

  it('releases the reservation when the model call fails', async () => {
    const { service, metaClient, budgetGuard } = build(null, {});
    metaClient.chatJson.mockResolvedValue({ ok: false, error: 'timeout' });

    const result = await service.translateMessage('msg-2', 'Yardım edin', 'en');

    expect(result).toBeNull();
    expect(budgetGuard.reconcile).toHaveBeenCalledWith(
      expect.objectContaining({ reservationId: 'res-1', actualUsd: 0 })
    );
  });

  it('skips the model when the text is confidently already in the operator language', async () => {
    const { service, prisma, metaClient, budgetGuard } = build(null, {});

    const result = await service.translateMessage('msg-3', 'Yardım edin', 'tr');

    expect(result).toBeNull();
    expect(metaClient.chatJson).not.toHaveBeenCalled();
    expect(budgetGuard.reserve).not.toHaveBeenCalled();
    expect(prisma.aiTranslationCache.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ sourceLanguage: 'tr', targetLanguage: 'tr' }) })
    );
  });

  it('skips the model for plain English text in EN mode, also for transcripts', async () => {
    const { service, metaClient } = build(null, {});

    expect(await service.translateMessage('msg-4', 'Please help, people are trapped', 'en')).toBeNull();
    expect(await service.translateTranscript('tr-1', 'We need help, emergency', 'en')).toBeNull();
    expect(metaClient.chatJson).not.toHaveBeenCalled();
  });

  it('still calls the model when the heuristic is not confident or the languages differ', async () => {
    const { service, metaClient } = build(null, { translated_text: 'Help us', detected_language: 'tr' });

    await service.translateMessage('msg-5', 'Yardım edin', 'en');
    await service.translateMessage('msg-6', 'hello', 'en');

    expect(metaClient.chatJson).toHaveBeenCalledTimes(2);
  });
});

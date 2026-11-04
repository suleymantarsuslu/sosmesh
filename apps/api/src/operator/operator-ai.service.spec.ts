import { OperatorAiService } from './operator-ai.service';
import { LocaleContentService } from '../ai/locale-content.service';

describe('OperatorAiService case AI views', () => {
  const noTranslation = { translatedTranscript: null, translatedText: null, translationLanguage: null };

  function build(
    overrides: { analysis?: unknown; attachments?: unknown[]; suggestions?: unknown[] },
    translationFields: typeof noTranslation = noTranslation
  ) {
    const translation = { getTranscriptTranslationFields: jest.fn().mockResolvedValue(translationFields) };
    const prisma = {
      aiAnalysis: { findFirst: jest.fn().mockResolvedValue(overrides.analysis ?? null) },
      attachment: { findMany: jest.fn().mockResolvedValue(overrides.attachments ?? []) },
      incidentLinkSuggestion: { findMany: jest.fn().mockResolvedValue(overrides.suggestions ?? []) },
    };
    const service = new OperatorAiService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      new LocaleContentService(),
      translation as never
    );
    return Object.assign(service, { translation });
  }

  const analysisRow = (status: string) => ({
    status,
    modelVersion: 'muse-spark-1.3',
    eventType: 'unknown',
    reportedPersonCount: null,
    needs: [],
    hazards: [],
    urgencySuggestion: 'unknown',
    missingInfo: [],
    summary: 'özet',
    nextStepSuggestion: 'adım',
    sourceQuotes: [],
    translation: null,
    followUpQuestions: [],
    operatorOverride: null,
    createdAt: new Date('2026-11-03T22:40:47.000Z'),
  });

  it('maps stored lowercase statuses (completed) instead of falling back to pending', async () => {
    const service = build({ analysis: analysisRow('completed') });
    const view = await service.getCaseAi('inc-1', 'tr');
    expect(view?.status).toBe('completed');
  });

  it('still maps uppercase and legacy statuses', async () => {
    expect((await build({ analysis: analysisRow('COMPLETED') }).getCaseAi('inc-1', 'tr'))?.status).toBe('completed');
    expect((await build({ analysis: analysisRow('NO_PLAINTEXT') }).getCaseAi('inc-1', 'tr'))?.status).toBe(
      'unavailable'
    );
    expect((await build({ analysis: analysisRow('weird') }).getCaseAi('inc-1', 'tr'))?.status).toBe('pending');
  });

  it('bundles triage, latest transcript and photo scene analysis for the panel', async () => {
    const service = build({
      analysis: analysisRow('completed'),
      attachments: [
        {
          id: 'photo-1',
          transcript: null,
          visionAnalysis: {
            sparkModel: 'muse-spark-1.3',
            createdAt: new Date('2026-11-03T23:07:28.000Z'),
            sparkSummary: {
              sceneSummary: 'scene',
              visibleHazards: ['smoke'],
              possiblePeopleIndicators: 'maybe',
              accessIssues: ['debris'],
              confidence: 'medium',
              limitations: ['dark', 'blurry'],
            },
          },
        },
        {
          id: 'audio-1',
          visionAnalysis: null,
          transcript: {
            id: 'tr-1',
            model: 'muse-voice-transcribe-1.0',
            transcript: 'help',
            turns: [],
            language: 'en',
            audioDurationMs: 3680,
            createdAt: new Date('2026-11-03T22:58:54.000Z'),
          },
        },
      ],
    });

    const bundle = await service.getCaseAiBundle('inc-1', 'en');

    expect(bundle.triage?.status).toBe('completed');
    expect(bundle.transcript).toMatchObject({ attachmentId: 'audio-1', language: 'en', audioDurationMs: 3680 });
    expect(bundle.sparkVision).toMatchObject({
      attachmentId: 'photo-1',
      model: 'muse-spark-1.3',
      summary: {
        description: 'scene',
        hazardsVisible: ['smoke'],
        uncertainty: 'dark; blurry',
        possiblePeopleIndicators: 'maybe',
        accessIssues: ['debris'],
        confidence: 'medium',
      },
    });
    expect(bundle.samVision).toBeNull();
    expect(bundle.linkSuggestions).toEqual([]);
  });

  it('returns nulls when nothing was analysed yet', async () => {
    const bundle = await build({}).getCaseAiBundle('inc-1', 'tr');
    expect(bundle).toEqual({ triage: null, transcript: null, sparkVision: null, samVision: null, linkSuggestions: [] });
  });

  it('adds the machine translation of the transcript for the UI locale', async () => {
    const service = build(
      {
        attachments: [
          {
            id: 'audio-1',
            visionAnalysis: null,
            transcript: {
              id: 'tr-1',
              model: 'm',
              transcript: 'yardım edin',
              turns: [],
              language: 'tr',
              audioDurationMs: 3000,
              createdAt: new Date('2026-11-03T22:58:54.000Z'),
            },
          },
        ],
      },
      { translatedTranscript: 'help us', translatedText: 'help us', translationLanguage: 'en' }
    );

    const bundle = await service.getCaseAiBundle('inc-1', 'en');

    expect(service.translation.getTranscriptTranslationFields).toHaveBeenCalledWith('tr-1', 'yardım edin', 'tr', 'en');
    expect(bundle.transcript).toMatchObject({
      transcript: 'yardım edin',
      translatedTranscript: 'help us',
      translatedText: 'help us',
      translationLanguage: 'en',
    });
  });
});

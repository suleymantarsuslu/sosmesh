/**
 * Vision Analysis Service
 * Work Package C - Vision
 * 
 * Analyzes disaster photos using:
 * - Muse Spark 1.3: scene understanding with strict json_schema
 * - SAM 3.1: object segmentation (person, debris, fire, smoke, water, vehicle)
 * 
 * Stores results SEPARATELY in AiVisionAnalysis
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MetaModelClient } from '../meta-model-client';
import { BudgetGuardService } from '../budget-guard.service';

// Fixed concepts for SAM (max 6 per photo, rate limit 60/min)
const SAM_CONCEPTS = ['person', 'debris', 'fire', 'smoke', 'water', 'vehicle'] as const;

type SparkVisionSchema = {
  sceneSummary: string;
  visibleHazards: string[];
  possiblePeopleIndicators: string;
  accessIssues: string[];
  confidence: 'low' | 'medium' | 'high';
  limitations: string[];
};

export type VisionAnalysisRequest = {
  attachmentId: string;
  imageBuffer: Buffer;
  mimeType: string;
  incidentContext?: string;
};

export type VisionAnalysisResult =
  | { success: true; analysisId: string }
  | { success: false; error: string };

@Injectable()
export class VisionAnalysisService {
  private readonly logger = new Logger(VisionAnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metaClient: MetaModelClient,
    private readonly budgetGuard: BudgetGuardService
  ) {}

  /**
   * Analyze a disaster photo with Spark + SAM
   */
  async analyzePhoto(request: VisionAnalysisRequest): Promise<VisionAnalysisResult> {
    this.logger.log({
      msg: 'Starting vision analysis',
      attachmentId: request.attachmentId,
      mimeType: request.mimeType,
    });

    // Step 1: Run Spark image analysis
    const sparkResult = await this.runSparkAnalysis(
      request.imageBuffer,
      request.mimeType,
      request.incidentContext
    );

    if (!sparkResult.ok) {
      this.logger.error({
        msg: 'Spark analysis failed',
        attachmentId: request.attachmentId,
        error: sparkResult.error,
      });
      return { success: false, error: `Spark analysis failed: ${sparkResult.error}` };
    }

    // Step 2: Run SAM segmentation for each concept
    const samResults = await this.runSamSegmentation(request.imageBuffer, request.mimeType);

    // Step 3: Store results in database
    try {
      const analysis = await this.prisma.aiVisionAnalysis.create({
        data: {
          attachmentId: request.attachmentId,
          sparkSummary: sparkResult.summary,
          samResults: samResults,
          sparkModel: sparkResult.model,
          samModel: samResults.length > 0 ? 'sam-3.1' : null,
        },
      });

      this.logger.log({
        msg: 'Vision analysis complete',
        attachmentId: request.attachmentId,
        analysisId: analysis.id,
        sparkConfidence: sparkResult.summary.confidence,
        samSegmentCount: samResults.reduce((sum, r) => sum + r.segments.length, 0),
      });

      return { success: true, analysisId: analysis.id };
    } catch (error) {
      this.logger.error({
        err: error,
        msg: 'Failed to store vision analysis',
        attachmentId: request.attachmentId,
      });
      return { success: false, error: 'Failed to store analysis' };
    }
  }

  /**
   * Run Spark image analysis with strict json_schema
   */
  private async runSparkAnalysis(
    imageBuffer: Buffer,
    mimeType: string,
    incidentContext?: string
  ): Promise<
    | { ok: true; summary: SparkVisionSchema; model: string }
    | { ok: false; error: string }
  > {
    // Reserve budget (estimate ~1500 tokens for image + ~500 for response)
    const estimatedUsd = this.metaClient.computeCost('muse-spark-1.3', 1500, 500);
    const reservation = await this.budgetGuard.reserve(estimatedUsd, 'muse-spark-1.3');

    if (!reservation.reserved) {
      return { ok: false, error: `Budget limit: ${reservation.reason}` };
    }

    const dataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

    const systemPrompt = `You are analyzing a disaster scene photo for emergency responders.
CRITICAL RULES:
- Never fabricate details not visible in the image
- Use "possiblePeopleIndicators" for uncertain human presence (clothing, belongings, shadows)
- Never say "definitely" or "confirmed" about people unless clearly visible
- List only visible hazards
- State limitations and uncertainties
- Operator will make final decisions`;

    const userPrompt = incidentContext
      ? `Analyze this disaster scene photo. Context from SOS message: ${incidentContext}\n\nDescribe what is visible, hazards, possible indicators of people, access issues, and your confidence level.`
      : `Analyze this disaster scene photo. Describe what is visible, hazards, possible indicators of people, access issues, and your confidence level.`;

    const schema = {
      name: 'DisasterVisionAnalysis',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          sceneSummary: {
            type: 'string',
            description: 'Brief description of what is visible in the scene',
          },
          visibleHazards: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of visible hazards (fire, smoke, structural damage, etc.)',
          },
          possiblePeopleIndicators: {
            type: 'string',
            description:
              'Uncertain indicators that people may be present (clothing, belongings, shadows) - use cautious wording',
          },
          accessIssues: {
            type: 'array',
            items: { type: 'string' },
            description: 'Visible obstacles or access difficulties for responders',
          },
          confidence: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'Overall confidence in this analysis',
          },
          limitations: {
            type: 'array',
            items: { type: 'string' },
            description: 'Factors limiting this analysis (lighting, angle, obstructions)',
          },
        },
        required: [
          'sceneSummary',
          'visibleHazards',
          'possiblePeopleIndicators',
          'accessIssues',
          'confidence',
          'limitations',
        ],
        additionalProperties: false,
      },
    };

    const response = await this.metaClient.chatJson({
      schema,
      prompt: userPrompt,
      systemPrompt,
      images: [{ dataUrl }],
      reasoningEffort: 'minimal',
    });

    // Reconcile budget with actual usage
    if (response.ok) {
      const actualUsd = this.metaClient.computeCost(
        'muse-spark-1.3',
        response.usage.inputTokens,
        response.usage.outputTokens
      );
      await this.budgetGuard.reconcile({
        reservationId: reservation.reservationId,
        actualUsd,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        model: 'muse-spark-1.3',
        requestId: response.requestId,
      });

      return {
        ok: true,
        summary: response.json as SparkVisionSchema,
        model: response.model,
      };
    }

    // Failed - reconcile with zero actual cost
    await this.budgetGuard.reconcile({
      reservationId: reservation.reservationId,
      actualUsd: 0,
      inputTokens: 0,
      outputTokens: 0,
      model: 'muse-spark-1.3',
      requestId: 'failed',
    });

    return { ok: false, error: response.error };
  }

  /**
   * Run SAM segmentation for fixed concept list
   * Rate limited to 60/min by MetaModelClient
   */
  private async runSamSegmentation(
    imageBuffer: Buffer,
    mimeType: string
  ): Promise<
    Array<{
      concept: string;
      segments: Array<{
        id: string;
        confidence: number | null;
        boundingBox: {
          x1: number;
          y1: number;
          x2: number;
          y2: number;
          width: number;
          height: number;
        };
        mask: {
          x: number;
          y: number;
          width: number;
          height: number;
          encoding: string;
          data: string;
        } | null;
      }>;
    }>
  > {
    const results: Array<{
      concept: string;
      segments: Array<{
        id: string;
        confidence: number | null;
        boundingBox: {
          x1: number;
          y1: number;
          x2: number;
          y2: number;
          width: number;
          height: number;
        };
        mask: {
          x: number;
          y: number;
          width: number;
          height: number;
          encoding: string;
          data: string;
        } | null;
      }>;
    }> = [];

    // Reserve budget for SAM (6 images max)
    const estimatedUsd = this.metaClient.computeSamCost(SAM_CONCEPTS.length);
    const reservation = await this.budgetGuard.reserve(estimatedUsd, 'sam-3.1');

    if (!reservation.reserved) {
      this.logger.warn({
        msg: 'SAM budget exhausted, skipping segmentation',
        reason: reservation.reason,
      });
      return results;
    }

    let imagesProcessed = 0;

    for (const concept of SAM_CONCEPTS) {
      try {
        const response = await this.metaClient.samSegment({
          imageBuffer,
          mimeType,
          concept,
        });

        if (response.ok) {
          imagesProcessed += response.imagesProcessed;
          results.push({
            concept,
            segments: response.segments,
          });

          this.logger.log({
            msg: 'SAM segmentation complete',
            concept,
            segmentCount: response.segments.length,
          });
        } else {
          this.logger.warn({
            msg: 'SAM segmentation failed',
            concept,
            error: response.error,
          });
        }
      } catch (error) {
        this.logger.error({
          err: error,
          msg: 'SAM request failed',
          concept,
        });
      }
    }

    // Reconcile budget with actual SAM cost
    const actualUsd = this.metaClient.computeSamCost(imagesProcessed);
    await this.budgetGuard.reconcile({
      reservationId: reservation.reservationId,
      actualUsd,
      inputTokens: 0,
      outputTokens: 0,
      model: 'sam-3.1',
      requestId: `sam-${imagesProcessed}`,
    });

    return results;
  }
}

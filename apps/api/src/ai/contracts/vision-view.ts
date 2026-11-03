/**
 * Vision View Contract - Operator API response shape
 * Work Package A - AI Foundation (Spark and SAM separate)
 */

export type SparkVisionSummary = {
  description: string;
  visibleObjects: string[];
  estimatedPersonCount: number | null;
  hazardsVisible: string[];
  uncertainty: string | null;
};

export type SamSegmentResult = {
  id: string;
  concept: string;
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
};

export type SparkVisionView = {
  attachmentId: string;
  model: string;
  summary: SparkVisionSummary;
  analyzedAt: string;
};

export type SamVisionView = {
  attachmentId: string;
  model: string;
  results: SamSegmentResult[];
  analyzedAt: string;
};

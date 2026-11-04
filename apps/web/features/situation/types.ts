export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type Urgency = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type RegionalCluster = {
  region: string;
  hazardType: string;
  incidentCount: number;
  estimatedPeopleAffected: number;
  severity: Severity;
  urgency: Urgency;
  firstReportAt: string;
  lastReportAt: string;
  topNeeds: string[];
  topHazards: string[];
  incidents: Array<{
    id: string;
    shortId: string;
    sosType: string;
    urgency: string | null;
    personCount: number | null;
  }>;
  aiSummary?: {
    status: 'computing' | 'ready' | 'failed';
    text?: string;
  };
};

export type RegionalSituationResponse = {
  clusters: RegionalCluster[];
  generatedAt: string;
  windowHours: number;
};

export type SituationFilters = {
  windowHours: number;
  minUrgency?: string;
};

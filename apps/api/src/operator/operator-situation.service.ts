/**
 * OperatorSituationService - Regional situation analysis
 * 
 * Spatial clustering and deterministic severity/urgency scoring for active incidents.
 * Optional AI summaries with appropriate disclaimers.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MetaModelClient } from '../ai/meta-model-client';
import { BudgetGuardService } from '../ai/budget-guard.service';
import { IncidentScopeService } from '../organization/incident-scope.service';
import { OperatorRequestUser } from './guards/operator-auth.guard';

type IncidentForClustering = {
  id: string;
  createdAt: Date;
  latestLatitude: { toNumber(): number } | number | null;
  latestLongitude: { toNumber(): number } | number | null;
  latestLocationAt: Date | null;
  lastMessageAt: Date | null;
  mergedMessageCount: number;
  sosMessages: Array<{
    id: string;
    sosType: string;
    personCount: number | null;
    receivedAt: Date;
  }>;
  aiAnalyses: Array<{
    eventType: string | null;
    urgencySuggestion: string | null;
    needs: unknown;
    hazards: unknown;
    reportedPersonCount: number | null;
  }>;
};

type RegionalCluster = {
  region: string;
  hazardType: string;
  incidentCount: number;
  estimatedPeopleAffected: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  firstReportAt: Date;
  lastReportAt: Date;
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
  generatedAt: Date;
  windowHours: number;
};

@Injectable()
export class OperatorSituationService {
  private readonly logger = new Logger(OperatorSituationService.name);

  private readonly clusterRadiusMeters = Number(
    process.env.SITUATION_CLUSTER_RADIUS_METERS ?? 2000
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: IncidentScopeService,
    private readonly metaClient: MetaModelClient,
    private readonly budget: BudgetGuardService
  ) {}

  async getRegionalSituation(
    user: OperatorRequestUser,
    windowHours: number = 24,
    minUrgency?: string
  ): Promise<RegionalSituationResponse> {
    const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    const scopeWhere = this.scope.incidentWhere(user);

    const incidents = await this.prisma.incident.findMany({
      where: {
        ...scopeWhere,
        deletedAt: null,
        archiveReason: null,
        state: { in: ['PENDING', 'ASSIGNED', 'IN_PROGRESS'] },
        lastMessageAt: { gte: cutoff },
      },
      include: {
        sosMessages: {
          select: {
            id: true,
            sosType: true,
            personCount: true,
            receivedAt: true,
          },
          orderBy: { receivedAt: 'desc' },
          take: 5,
        },
        aiAnalyses: {
          select: {
            eventType: true,
            urgencySuggestion: true,
            needs: true,
            hazards: true,
            reportedPersonCount: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 500,
    });

    const clusters = this.clusterIncidents(
      incidents as IncidentForClustering[],
      windowHours
    );

    const filtered = minUrgency
      ? clusters.filter((c) => this.urgencyRank(c.urgency) >= this.urgencyRank(minUrgency))
      : clusters;

    const sorted = filtered.sort(
      (a, b) =>
        this.urgencyRank(b.urgency) - this.urgencyRank(a.urgency) ||
        this.severityRank(b.severity) - this.severityRank(a.severity)
    );

    await this.attachAiSummaries(sorted);

    return {
      clusters: sorted,
      generatedAt: new Date(),
      windowHours,
    };
  }

  private clusterIncidents(
    incidents: IncidentForClustering[],
    windowHours: number
  ): RegionalCluster[] {
    const spatialClusters = this.spatialCluster(incidents);

    const clusters: RegionalCluster[] = [];

    for (const spatialGroup of spatialClusters) {
      const hazardGroups = this.groupByHazard(spatialGroup);

      for (const [hazardType, hazardIncidents] of Object.entries(hazardGroups)) {
        if (hazardIncidents.length === 0) continue;

        const cluster = this.buildCluster(hazardType, hazardIncidents, windowHours);
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  private spatialCluster(incidents: IncidentForClustering[]): IncidentForClustering[][] {
    const clusters: IncidentForClustering[][] = [];
    const assigned = new Set<string>();

    for (const incident of incidents) {
      if (assigned.has(incident.id)) continue;

      const lat1 = incident.latestLatitude;
      const lon1 = incident.latestLongitude;

      if (lat1 === null || lon1 === null) {
        clusters.push([incident]);
        assigned.add(incident.id);
        continue;
      }

      const cluster: IncidentForClustering[] = [incident];
      assigned.add(incident.id);

      for (const other of incidents) {
        if (assigned.has(other.id)) continue;

        const lat2 = other.latestLatitude;
        const lon2 = other.latestLongitude;

        if (lat2 === null || lon2 === null) continue;

        const distance = this.haversineDistance(
          this.toNumber(lat1),
          this.toNumber(lon1),
          this.toNumber(lat2),
          this.toNumber(lon2)
        );

        if (distance <= this.clusterRadiusMeters) {
          cluster.push(other);
          assigned.add(other.id);
        }
      }

      clusters.push(cluster);
    }

    return clusters;
  }

  private groupByHazard(
    incidents: IncidentForClustering[]
  ): Record<string, IncidentForClustering[]> {
    const groups: Record<string, IncidentForClustering[]> = {};

    for (const incident of incidents) {
      const hazard = this.determineHazard(incident);
      if (!groups[hazard]) {
        groups[hazard] = [];
      }
      groups[hazard].push(incident);
    }

    return groups;
  }

  private determineHazard(incident: IncidentForClustering): string {
    const latestMessage = incident.sosMessages[0];
    if (!latestMessage) return 'GENERAL';

    const sosType = latestMessage.sosType;

    const analysis = incident.aiAnalyses[0];
    if (analysis?.eventType) {
      return analysis.eventType.toUpperCase().replace(/[^A-Z_]/g, '_');
    }

    const hazards = this.extractArray(analysis?.hazards);
    if (hazards.length > 0) {
      return hazards[0].toUpperCase().replace(/[^A-Z_]/g, '_');
    }

    return sosType.toUpperCase();
  }

  private buildCluster(
    hazardType: string,
    incidents: IncidentForClustering[],
    windowHours: number
  ): RegionalCluster {
    const region = this.determineRegion(incidents);

    let totalPeople = 0;
    const allNeeds: string[] = [];
    const allHazards: string[] = [];
    let earliestReport: Date | null = null;
    let latestReport: Date | null = null;

    const simplifiedIncidents = incidents.map((inc) => {
      const latestMessage = inc.sosMessages[0];
      const analysis = inc.aiAnalyses[0];

      const personCount = analysis?.reportedPersonCount ?? latestMessage?.personCount ?? 1;
      totalPeople += personCount;

      const receivedAt = latestMessage?.receivedAt ?? inc.createdAt;
      if (!earliestReport || receivedAt < earliestReport) {
        earliestReport = receivedAt;
      }
      if (!latestReport || receivedAt > latestReport) {
        latestReport = receivedAt;
      }

      allNeeds.push(...this.extractArray(analysis?.needs));
      allHazards.push(...this.extractArray(analysis?.hazards));

      return {
        id: inc.id,
        shortId: inc.id.substring(0, 8),
        sosType: latestMessage?.sosType ?? 'GENERAL',
        urgency: analysis?.urgencySuggestion ?? null,
        personCount,
      };
    });

    const topNeeds = this.topN(allNeeds, 3);
    const topHazards = this.topN(allHazards, 3);

    const severity = this.computeSeverity(
      incidents.length,
      totalPeople,
      topHazards
    );

    const urgency = this.computeUrgency(
      incidents,
      topHazards,
      earliestReport,
      latestReport,
      windowHours
    );

    return {
      region,
      hazardType,
      incidentCount: incidents.length,
      estimatedPeopleAffected: totalPeople,
      severity,
      urgency,
      firstReportAt: earliestReport ?? incidents[0].createdAt,
      lastReportAt: latestReport ?? incidents[0].createdAt,
      topNeeds,
      topHazards,
      incidents: simplifiedIncidents,
    };
  }

  private determineRegion(incidents: IncidentForClustering[]): string {
    const latitudes: number[] = [];
    const longitudes: number[] = [];

    for (const inc of incidents) {
      if (inc.latestLatitude !== null && inc.latestLongitude !== null) {
        latitudes.push(this.toNumber(inc.latestLatitude));
        longitudes.push(this.toNumber(inc.latestLongitude));
      }
    }

    if (latitudes.length === 0) {
      return 'UNKNOWN_LOCATION';
    }

    const centerLat = latitudes.reduce((a, b) => a + b, 0) / latitudes.length;
    const centerLon = longitudes.reduce((a, b) => a + b, 0) / longitudes.length;

    return `REGION_${centerLat.toFixed(2)}_${centerLon.toFixed(2)}`;
  }

  private toNumber(value: { toNumber(): number } | number | null): number {
    if (value === null) return 0;
    if (typeof value === 'number') return value;
    return value.toNumber();
  }

  private computeSeverity(
    incidentCount: number,
    peopleAffected: number,
    topHazards: string[]
  ): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
    let score = 0;

    if (incidentCount >= 10) score += 3;
    else if (incidentCount >= 5) score += 2;
    else if (incidentCount >= 2) score += 1;

    if (peopleAffected >= 50) score += 3;
    else if (peopleAffected >= 20) score += 2;
    else if (peopleAffected >= 5) score += 1;

    const criticalHazards = ['trapped', 'fire', 'flood', 'injury', 'medical'];
    const hasCritical = topHazards.some((h) =>
      criticalHazards.some((c) => h.toLowerCase().includes(c))
    );

    if (hasCritical) score += 2;

    if (score >= 6) return 'CRITICAL';
    if (score >= 4) return 'HIGH';
    if (score >= 2) return 'MEDIUM';
    return 'LOW';
  }

  private computeUrgency(
    incidents: IncidentForClustering[],
    topHazards: string[],
    earliestReport: Date | null,
    latestReport: Date | null,
    windowHours: number
  ): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
    let score = 0;

    const now = Date.now();
    if (latestReport) {
      const minutesSinceLatest = (now - latestReport.getTime()) / 60000;
      if (minutesSinceLatest < 15) score += 3;
      else if (minutesSinceLatest < 60) score += 2;
      else if (minutesSinceLatest < 240) score += 1;
    }

    const criticalHazards = ['trapped', 'fire', 'medical', 'injury'];
    const hasCritical = topHazards.some((h) =>
      criticalHazards.some((c) => h.toLowerCase().includes(c))
    );
    if (hasCritical) score += 2;

    const criticalUrgencies = incidents.filter(
      (inc) =>
        inc.aiAnalyses[0]?.urgencySuggestion?.toLowerCase() === 'critical' ||
        inc.aiAnalyses[0]?.urgencySuggestion?.toLowerCase() === 'high'
    );
    const urgencyRatio = criticalUrgencies.length / incidents.length;
    if (urgencyRatio >= 0.5) score += 2;
    else if (urgencyRatio >= 0.25) score += 1;

    if (score >= 5) return 'CRITICAL';
    if (score >= 3) return 'HIGH';
    if (score >= 1) return 'MEDIUM';
    return 'LOW';
  }

  private async attachAiSummaries(clusters: RegionalCluster[]): Promise<void> {
    const topClusters = clusters.slice(0, 5);

    for (const cluster of topClusters) {
      const clusterKey = this.getClusterKey(cluster);

      const cached = await this.prisma.regionalClusterSummary.findUnique({
        where: { clusterKey },
      });

      if (cached && cached.expiresAt > new Date()) {
        if (cached.status === 'ready' && cached.summary) {
          cluster.aiSummary = {
            status: 'ready',
            text: cached.summary,
          };
        } else if (cached.status === 'computing') {
          cluster.aiSummary = {
            status: 'computing',
          };
        } else if (cached.status === 'failed') {
          cluster.aiSummary = {
            status: 'failed',
          };
        }
        continue;
      }

      if (!cached) {
        await this.initiateAiSummary(cluster);
        cluster.aiSummary = {
          status: 'computing',
        };
      }
    }
  }

  private async initiateAiSummary(cluster: RegionalCluster): Promise<void> {
    const clusterKey = this.getClusterKey(cluster);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    try {
      await this.prisma.regionalClusterSummary.create({
        data: {
          clusterKey,
          status: 'pending',
          incidentIds: cluster.incidents.map((i) => i.id),
          expiresAt,
        },
      });
    } catch (error) {
      this.logger.warn({ msg: 'Failed to create summary cache', error });
      return;
    }

    this.generateAiSummary(clusterKey, cluster).catch((error) => {
      this.logger.error({ msg: 'AI summary generation failed', error });
    });
  }

  private async generateAiSummary(
    clusterKey: string,
    cluster: RegionalCluster
  ): Promise<void> {
    await this.prisma.regionalClusterSummary.update({
      where: { clusterKey },
      data: { status: 'computing' },
    });

    const budgetCheck = await this.budget.check();
    if (!budgetCheck.allowed) {
      await this.prisma.regionalClusterSummary.update({
        where: { clusterKey },
        data: {
          status: 'failed',
          lastError: 'Budget limit reached',
        },
      });
      return;
    }

    const prompt = this.buildSummaryPrompt(cluster);

    const schema = {
      name: 'RegionalSituationSummary',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: 'Brief 2-3 sentence summary of the regional situation',
          },
        },
        required: ['summary'],
        additionalProperties: false,
      },
    };

    const estimatedUsd = 0.002;
    const reservation = await this.budget.reserve(estimatedUsd, 'muse-spark-1.3');

    if (!reservation.reserved) {
      await this.prisma.regionalClusterSummary.update({
        where: { clusterKey },
        data: {
          status: 'failed',
          lastError: 'Budget reservation failed',
        },
      });
      return;
    }

    const response = await this.metaClient.chatJson({
      schema,
      prompt,
      reasoningEffort: 'minimal',
    });

    if (response.ok === false) {
      await this.budget.reconcile({
        reservationId: reservation.reservationId,
        actualUsd: 0,
        inputTokens: 0,
        outputTokens: 0,
        model: 'muse-spark-1.3',
        requestId: 'failed',
      });

      await this.prisma.regionalClusterSummary.update({
        where: { clusterKey },
        data: {
          status: 'failed',
          lastError: response.error,
        },
      });
      return;
    }

    const actualCost = this.metaClient.computeCost(
      response.model,
      response.usage.inputTokens,
      response.usage.outputTokens
    );

    await this.budget.reconcile({
      reservationId: reservation.reservationId,
      actualUsd: actualCost,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      model: response.model,
      requestId: response.requestId,
    });

    const summary = response.json.summary as string;

    await this.prisma.regionalClusterSummary.update({
      where: { clusterKey },
      data: {
        status: 'ready',
        summary,
      },
    });
  }

  private buildSummaryPrompt(cluster: RegionalCluster): string {
    return `You are analyzing a cluster of emergency incidents in a regional disaster situation.

<cluster_data>
Region: ${cluster.region}
Hazard type: ${cluster.hazardType}
Number of incidents: ${cluster.incidentCount}
Estimated people affected: ${cluster.estimatedPeopleAffected}
Severity: ${cluster.severity}
Urgency: ${cluster.urgency}
Top needs: ${cluster.topNeeds.join(', ') || 'none'}
Top hazards: ${cluster.topHazards.join(', ') || 'none'}
Time span: ${cluster.firstReportAt.toISOString()} to ${cluster.lastReportAt.toISOString()}
</cluster_data>

Write a brief 2-3 sentence summary in Turkish of this regional situation for the operator dashboard. Focus on the hazard type, scale, and key needs. Use uncertain language ("olabilir", "görünüyor") and never state absolute certainty. This is for operator awareness only; all decisions remain with the human operator.`;
  }

  private getClusterKey(cluster: RegionalCluster): string {
    const incidentIds = cluster.incidents.map((i) => i.id).sort();
    const hash = incidentIds.join('-').substring(0, 100);
    return `${cluster.region}-${cluster.hazardType}-${hash}`;
  }

  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private extractArray(val: unknown): string[] {
    if (Array.isArray(val)) {
      return val.filter((x) => typeof x === 'string');
    }
    return [];
  }

  private topN(items: string[], n: number): string[] {
    const counts = new Map<string, number>();
    for (const item of items) {
      const normalized = item.toLowerCase();
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([item]) => item);
  }

  private urgencyRank(urgency: string): number {
    const ranks: Record<string, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };
    return ranks[urgency.toUpperCase()] ?? 0;
  }

  private severityRank(severity: string): number {
    const ranks: Record<string, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };
    return ranks[severity.toUpperCase()] ?? 0;
  }
}

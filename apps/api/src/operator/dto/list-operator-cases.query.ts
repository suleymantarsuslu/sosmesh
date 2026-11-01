import { DeliveryState, IncidentState, LocationStatus, SosType } from '@prisma/client';

const SOS_TYPES = new Set<string>(Object.values(SosType));
const INCIDENT_STATES = new Set<string>(Object.values(IncidentState));
const DELIVERY_STATES = new Set<string>(Object.values(DeliveryState));
const LOCATION_STATUSES = new Set<string>(Object.values(LocationStatus));

export type ListOperatorCasesQuery = {
  cursor?: string;
  limit: number;
  category?: SosType;
  incidentState?: IncidentState;
  deliveryState?: DeliveryState;
  locationStatus?: LocationStatus;
  source?: string;
  receivedFrom?: Date;
  receivedTo?: Date;
  accuracyMin?: number;
  accuracyMax?: number;
  search?: string;
};

export function parseListOperatorCasesQuery(input: {
  cursor?: string;
  limit?: string;
  category?: string;
  incidentState?: string;
  deliveryState?: string;
  locationStatus?: string;
  source?: string;
  from?: string;
  to?: string;
  accuracyMin?: string;
  accuracyMax?: string;
  search?: string;
}): ListOperatorCasesQuery {
  const limitRaw = input.limit ? Number(input.limit) : 50;
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 100) : 50;

  const category =
    input.category && SOS_TYPES.has(input.category)
      ? (input.category as SosType)
      : undefined;
  const incidentState =
    input.incidentState && INCIDENT_STATES.has(input.incidentState)
      ? (input.incidentState as IncidentState)
      : undefined;
  const deliveryState =
    input.deliveryState && DELIVERY_STATES.has(input.deliveryState)
      ? (input.deliveryState as DeliveryState)
      : undefined;
  const locationStatus =
    input.locationStatus && LOCATION_STATUSES.has(input.locationStatus)
      ? (input.locationStatus as LocationStatus)
      : undefined;

  let receivedFrom: Date | undefined;
  if (input.from) {
    const parsed = Date.parse(input.from);
    if (!Number.isNaN(parsed)) {
      receivedFrom = new Date(parsed);
    }
  }
  let receivedTo: Date | undefined;
  if (input.to) {
    const parsed = Date.parse(input.to);
    if (!Number.isNaN(parsed)) {
      receivedTo = new Date(parsed);
    }
  }

  let accuracyMin: number | undefined;
  if (input.accuracyMin !== undefined && input.accuracyMin !== '') {
    const value = Number(input.accuracyMin);
    if (Number.isFinite(value) && value >= 0) {
      accuracyMin = value;
    }
  }
  let accuracyMax: number | undefined;
  if (input.accuracyMax !== undefined && input.accuracyMax !== '') {
    const value = Number(input.accuracyMax);
    if (Number.isFinite(value) && value >= 0) {
      accuracyMax = value;
    }
  }

  const source =
    input.source && input.source.trim().length > 0 ? input.source.trim().slice(0, 64) : undefined;

  const search =
    input.search && input.search.trim().length > 0
      ? input.search.trim().slice(0, 128)
      : undefined;

  return {
    cursor: input.cursor,
    limit,
    category,
    incidentState,
    deliveryState,
    locationStatus,
    source,
    receivedFrom,
    receivedTo,
    accuracyMin,
    accuracyMax,
    search,
  };
}

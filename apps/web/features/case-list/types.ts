export type OperatorCaseRow = {
  incidentId: string;
  incidentState: string;
  messageId: string;
  sosMessageId: string;
  priority: number;
  sosType: string;
  deliveryState: string;
  locationStatus: string;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  locationApproximate: boolean;
  receivedAt: string;
  source: string | null;
};

export type CaseFiltersState = {
  search: string;
  category: string;
  incidentState: string;
  deliveryState: string;
  locationStatus: string;
  source: string;
  accuracyMax: string;
};

export type FeedEvent = {
  id: string;
  messageId: string;
  incidentId: string;
  priority: number;
  locationStatus: string;
  latitude: number | null;
  longitude: number | null;
  occurredAt: string;
};

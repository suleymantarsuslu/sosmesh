import { describe, it, expect } from '@jest/globals';

type FeedEvent = {
  incidentId: string;
  messageId: string;
  priority: number;
  locationStatus: string;
  latitude: number | null;
  longitude: number | null;
  occurredAt: string;
};

type OperatorCaseRow = {
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

function feedEventToCase(event: FeedEvent, existing?: OperatorCaseRow): OperatorCaseRow {
  const hasNewLocation = event.latitude !== null && event.longitude !== null;
  const hasPreviousLocation = existing?.latitude !== null && existing?.longitude !== null;

  return {
    incidentId: event.incidentId,
    incidentState: existing?.incidentState ?? 'PENDING',
    messageId: event.messageId,
    sosMessageId: existing?.sosMessageId ?? event.messageId,
    priority: event.priority,
    sosType: existing?.sosType ?? 'GENERAL',
    deliveryState: existing?.deliveryState ?? 'SERVER_ACCEPTED',
    locationStatus: event.locationStatus,
    latitude: hasNewLocation ? event.latitude : (hasPreviousLocation ? existing.latitude : null),
    longitude: hasNewLocation ? event.longitude : (hasPreviousLocation ? existing.longitude : null),
    accuracyMeters: hasNewLocation ? (existing?.accuracyMeters ?? null) : (hasPreviousLocation ? existing!.accuracyMeters : null),
    locationApproximate: hasNewLocation ? (existing?.locationApproximate ?? false) : (hasPreviousLocation ? existing!.locationApproximate : false),
    receivedAt: event.occurredAt,
    source: existing?.source ?? 'feed',
  };
}

describe('feedEventToCase - SSE merge logic', () => {
  it('should preserve previous location when event has no coordinates', () => {
    const existing: OperatorCaseRow = {
      incidentId: 'inc-1',
      incidentState: 'PENDING',
      messageId: 'msg-1',
      sosMessageId: 'sos-1',
      priority: 2,
      sosType: 'MEDICAL',
      deliveryState: 'SERVER_ACCEPTED',
      locationStatus: 'GPS',
      latitude: 40.7128,
      longitude: 29.5456,
      accuracyMeters: 15,
      locationApproximate: false,
      receivedAt: '2024-01-01T10:00:00Z',
      source: 'feed',
    };

    const event: FeedEvent = {
      incidentId: 'inc-1',
      messageId: 'msg-2',
      priority: 1,
      locationStatus: 'UNKNOWN',
      latitude: null,
      longitude: null,
      occurredAt: '2024-01-01T11:00:00Z',
    };

    const result = feedEventToCase(event, existing);

    expect(result.latitude).toBe(40.7128);
    expect(result.longitude).toBe(29.5456);
    expect(result.accuracyMeters).toBe(15);
    expect(result.locationApproximate).toBe(false);
  });

  it('should replace location when event has new coordinates', () => {
    const existing: OperatorCaseRow = {
      incidentId: 'inc-1',
      incidentState: 'PENDING',
      messageId: 'msg-1',
      sosMessageId: 'sos-1',
      priority: 2,
      sosType: 'MEDICAL',
      deliveryState: 'SERVER_ACCEPTED',
      locationStatus: 'GPS',
      latitude: 40.0,
      longitude: 29.0,
      accuracyMeters: 50,
      locationApproximate: false,
      receivedAt: '2024-01-01T10:00:00Z',
      source: 'feed',
    };

    const event: FeedEvent = {
      incidentId: 'inc-1',
      messageId: 'msg-2',
      priority: 1,
      locationStatus: 'GPS',
      latitude: 40.7128,
      longitude: 29.5456,
      occurredAt: '2024-01-01T11:00:00Z',
    };

    const result = feedEventToCase(event, existing);

    expect(result.latitude).toBe(40.7128);
    expect(result.longitude).toBe(29.5456);
  });

  it('should use null location when event has no coords and no previous location exists', () => {
    const event: FeedEvent = {
      incidentId: 'inc-1',
      messageId: 'msg-1',
      priority: 1,
      locationStatus: 'UNKNOWN',
      latitude: null,
      longitude: null,
      occurredAt: '2024-01-01T11:00:00Z',
    };

    const result = feedEventToCase(event);

    expect(result.latitude).toBeNull();
    expect(result.longitude).toBeNull();
    expect(result.accuracyMeters).toBeNull();
  });

  it('should preserve metadata when keeping previous location', () => {
    const existing: OperatorCaseRow = {
      incidentId: 'inc-1',
      incidentState: 'IN_PROGRESS',
      messageId: 'msg-1',
      sosMessageId: 'sos-1',
      priority: 2,
      sosType: 'FIRE',
      deliveryState: 'DISPATCHED',
      locationStatus: 'GPS',
      latitude: 40.7128,
      longitude: 29.5456,
      accuracyMeters: 10,
      locationApproximate: true,
      receivedAt: '2024-01-01T10:00:00Z',
      source: 'webhook',
    };

    const event: FeedEvent = {
      incidentId: 'inc-1',
      messageId: 'msg-2',
      priority: 1,
      locationStatus: 'UNKNOWN',
      latitude: null,
      longitude: null,
      occurredAt: '2024-01-01T11:00:00Z',
    };

    const result = feedEventToCase(event, existing);

    expect(result.incidentState).toBe('IN_PROGRESS');
    expect(result.sosType).toBe('FIRE');
    expect(result.deliveryState).toBe('DISPATCHED');
    expect(result.locationApproximate).toBe(true);
    expect(result.source).toBe('webhook');
  });
});

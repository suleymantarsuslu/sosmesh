/**
 * SOSMesh Shared Contracts
 * Shared TypeScript types for API, web, and mobile apps
 */

export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
}

export interface SosMessage {
  id: string;
  userId: string;
  location: {
    latitude: number;
    longitude: number;
  };
  message?: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface SosStatusTimeline {
  1: string; // CİHAZDA KAYITLI
  2: string; // YAKIN CİHAZA AKTARILDI
  3: string; // SUNUCUYA ULAŞTI
  4: string; // OPERATÖR GÖRDÜ
  5: string; // VAKA İŞLEME ALINDI
}

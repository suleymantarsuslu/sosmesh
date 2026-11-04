export class BroadcastResponseDto {
  id!: string;
  title!: string;
  body!: string;
  severity!: string;
  createdAt!: string;
  expiresAt!: string;
  regionLatitude?: number | null;
  regionLongitude?: number | null;
  regionRadiusKm?: number | null;
  signature!: string;
  deliveredCount!: number;
  meshRelayCount!: number;
}

export class BroadcastHistoryDto {
  id!: string;
  title!: string;
  severity!: string;
  createdBy!: string;
  createdAt!: string;
  expiresAt!: string;
  hasRegion!: boolean;
  regionLabel?: string;
  deliveredCount!: number;
  meshRelayCount!: number;
}

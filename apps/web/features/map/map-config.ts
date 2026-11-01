export type MapStyleSpec = {
  version: 8;
  sources: Record<string, object>;
  layers: object[];
  glyphs?: string;
};

export function mapTileUrl(): string {
  return (
    process.env.NEXT_PUBLIC_MAP_TILE_URL ??
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
  );
}

export function isMapTestMode(): boolean {
  if (process.env.NEXT_PUBLIC_MAP_TEST_MODE === '1') {
    return true;
  }
  return process.env.NODE_ENV === 'test';
}

export function osmAttribution(): string {
  return '© OpenStreetMap contributors';
}

/** Local empty style — no external tile dependency (CI/unit/E2E). */
export function emptyMapStyle(): MapStyleSpec {
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#e8ecef' },
      },
    ],
  };
}

export function rasterOsmMapStyle(): MapStyleSpec {
  const tiles = [mapTileUrl()];
  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles,
        tileSize: 256,
        attribution: osmAttribution(),
      },
    },
    layers: [
      {
        id: 'osm',
        type: 'raster',
        source: 'osm',
      },
    ],
  };
}

export function resolveMapStyle(): MapStyleSpec {
  if (isMapTestMode()) {
    return emptyMapStyle();
  }
  return rasterOsmMapStyle();
}

'use client';

import Map, { Marker } from 'react-map-gl/maplibre';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { isMapTestMode, osmAttribution, resolveMapStyle } from '../../map/map-config';

type Props = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  approximate: boolean;
  zoom: number;
  ariaLabel: string;
};

function metersToPixels(lat: number, meters: number, zoom: number): number {
  const metersPerPixel = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
  return meters / metersPerPixel;
}

/** Small read-only map preview that reuses the Map page style/tile configuration. */
export default function CaseMiniMap({
  latitude,
  longitude,
  accuracyMeters,
  approximate,
  zoom,
  ariaLabel,
}: Props) {
  if (isMapTestMode()) {
    return (
      <div className="cd2-map cd2-map--test" role="img" aria-label={ariaLabel} data-testid="case-mini-map">
        <span className="cd2-map__pin" aria-hidden="true" />
      </div>
    );
  }

  const radiusMeters = approximate ? Math.max(1000, accuracyMeters ?? 1000) : Math.max(accuracyMeters ?? 0, 0);
  const radiusPx = Math.min(metersToPixels(latitude, radiusMeters, zoom), 160);

  return (
    <div className="cd2-map" role="img" aria-label={ariaLabel} data-testid="case-mini-map">
      <Map
        mapLib={maplibregl}
        initialViewState={{ latitude, longitude, zoom }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={resolveMapStyle() as maplibregl.StyleSpecification}
        scrollZoom={false}
        attributionControl={false}
      >
        <Marker latitude={latitude} longitude={longitude} anchor="center">
          <div className="cd2-map__marker">
            {radiusPx >= 6 ? (
              <span
                className="cd2-map__accuracy"
                style={{ width: radiusPx * 2, height: radiusPx * 2 }}
                aria-hidden="true"
              />
            ) : null}
            <span className="cd2-map__pin" aria-hidden="true" />
          </div>
        </Marker>
      </Map>
      <span className="cd2-map__attribution">{osmAttribution()}</span>
    </div>
  );
}

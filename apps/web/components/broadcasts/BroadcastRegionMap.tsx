'use client';

import * as maplibregl from 'maplibre-gl';
import { useRef, useCallback, useEffect, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import Map, { Marker, Layer, Source, type MapRef, type MapLayerMouseEvent } from 'react-map-gl/maplibre';

import { resolveMapStyle } from '../../features/map/map-config';

type Props = {
  latitude: number | undefined;
  longitude: number | undefined;
  radiusKm: number | undefined;
  onLocationChange: (lat: number, lng: number) => void;
  onRadiusChange: (radiusKm: number) => void;
};

export function BroadcastRegionMap({
  latitude,
  longitude,
  radiusKm,
  onLocationChange,
  onRadiusChange,
}: Props) {
  const mapRef = useRef<MapRef>(null);
  const [viewState, setViewState] = useState({
    longitude: longitude ?? 35.0,
    latitude: latitude ?? 39.0,
    zoom: 6,
  });

  useEffect(() => {
    if (latitude != null && longitude != null) {
      setViewState((prev) => ({
        ...prev,
        longitude,
        latitude,
        zoom: Math.max(prev.zoom, 8),
      }));
    }
  }, [latitude, longitude]);

  const handleMapClick = useCallback(
    (event: MapLayerMouseEvent) => {
      const { lngLat } = event;
      onLocationChange(lngLat.lat, lngLat.lng);
    },
    [onLocationChange]
  );

  const circleGeoJSON = latitude != null && longitude != null && radiusKm != null
    ? {
        type: 'FeatureCollection' as const,
        features: [
          {
            type: 'Feature' as const,
            geometry: {
              type: 'Point' as const,
              coordinates: [longitude, latitude],
            },
            properties: {
              radiusKm,
            },
          },
        ],
      }
    : null;

  return (
    <div className="broadcast-region-map-container">
      <div className="broadcast-region-map">
        <Map
          ref={mapRef}
          {...viewState}
          onMove={(evt) => setViewState(evt.viewState)}
          onClick={handleMapClick}
          style={{ width: '100%', height: '400px' }}
          mapLib={maplibregl}
          mapStyle={resolveMapStyle() as maplibregl.StyleSpecification}
        >
          {latitude != null && longitude != null && (
            <Marker longitude={longitude} latitude={latitude} anchor="center">
              <div className="broadcast-map-marker">
                <div className="broadcast-map-marker-pin" />
              </div>
            </Marker>
          )}

          {circleGeoJSON && (
            <Source id="broadcast-circle" type="geojson" data={circleGeoJSON}>
              <Layer
                id="broadcast-circle-fill"
                type="circle"
                paint={{
                  'circle-radius': [
                    'interpolate',
                    ['exponential', 2],
                    ['zoom'],
                    0,
                    0,
                    20,
                    metersToPixelsAtEquator(radiusKm! * 1000, 20),
                  ] as any,
                  'circle-color': '#3b82f6',
                  'circle-opacity': 0.2,
                }}
              />
              <Layer
                id="broadcast-circle-stroke"
                type="circle"
                paint={{
                  'circle-radius': [
                    'interpolate',
                    ['exponential', 2],
                    ['zoom'],
                    0,
                    0,
                    20,
                    metersToPixelsAtEquator(radiusKm! * 1000, 20),
                  ] as any,
                  'circle-color': '#3b82f6',
                  'circle-opacity': 0,
                  'circle-stroke-width': 2,
                  'circle-stroke-color': '#3b82f6',
                  'circle-stroke-opacity': 0.8,
                }}
              />
            </Source>
          )}
        </Map>
      </div>

      <div className="broadcast-region-controls">
        <label htmlFor="broadcast-radius-slider">
          Radius: {radiusKm?.toFixed(1) ?? 10} km
        </label>
        <input
          id="broadcast-radius-slider"
          type="range"
          min="0.5"
          max="500"
          step="0.5"
          value={radiusKm ?? 10}
          onChange={(e) => onRadiusChange(parseFloat(e.target.value))}
          className="broadcast-radius-slider"
        />
      </div>

      <p className="broadcast-map-hint">
        Click on the map to set the broadcast region center
      </p>
    </div>
  );
}

function metersToPixelsAtEquator(meters: number, zoom: number): number {
  return meters / (156543.03392 / Math.pow(2, zoom));
}

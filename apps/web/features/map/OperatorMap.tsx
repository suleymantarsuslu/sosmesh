'use client';

import { useMemo } from 'react';
import Map, { Marker } from 'react-map-gl/maplibre';
import * as maplibregl from 'maplibre-gl';
import Supercluster from 'supercluster';
import 'maplibre-gl/dist/maplibre-gl.css';

import {
  accuracyCircleRadiusMeters,
  accuracyVisualOpacity,
  hasPlottableCoordinates,
  SYNTHETIC_MAP_CENTER,
} from '../case-list/geo';
import type { AssignmentPreviewRoute } from '../assignment/types';
import type { OperatorCaseRow } from '../case-list/types';
import { isMapTestMode, osmAttribution, resolveMapStyle } from './map-config';
import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';

type Props = {
  rows: OperatorCaseRow[];
  selectedId: string | null;
  onSelect: (incidentId: string) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  assignmentPreview?: AssignmentPreviewRoute | null;
};

type ClusterProps = {
  cluster: boolean;
  cluster_id?: number;
  point_count?: number;
  incidentId?: string;
  priority?: number;
};

function metersToPixels(lat: number, meters: number, zoomLevel: number): number {
  const latRad = (lat * Math.PI) / 180;
  const metersPerPixel = (156543.03392 * Math.cos(latRad)) / Math.pow(2, zoomLevel);
  return meters / metersPerPixel;
}

function getSeverityColor(priority: number): string {
  if (priority <= 1) return '#dc2626';
  if (priority <= 2) return '#ea580c';
  if (priority <= 3) return '#d97706';
  return '#65a30d';
}

export function OperatorMap({
  rows,
  selectedId,
  onSelect,
  zoom,
  onZoomChange,
  assignmentPreview,
}: Props) {
  const testMode = isMapTestMode();
  const { t } = useOperatorPreferences();
  const plottable = useMemo(
    () => rows.filter((row) => hasPlottableCoordinates(row)),
    [rows]
  );

  const index = useMemo(() => {
    const cluster = new Supercluster<ClusterProps>({ radius: 50, maxZoom: 16 });
    cluster.load(
      plottable.map((row) => ({
        type: 'Feature',
        properties: {
          cluster: false,
          incidentId: row.incidentId,
          priority: row.priority,
        },
        geometry: {
          type: 'Point',
          coordinates: [row.longitude as number, row.latitude as number],
        },
      }))
    );
    return cluster;
  }, [plottable]);

  const bounds = [-180, -85, 180, 85] as [number, number, number, number];
  const clusters = index.getClusters(bounds, Math.floor(zoom));

  const rowByIncident = useMemo(() => {
    const rowMap = new globalThis.Map<string, OperatorCaseRow>();
    for (const row of plottable) {
      rowMap.set(row.incidentId, row);
    }
    return rowMap;
  }, [plottable]);

  if (testMode) {
    return (
      <div
        className="operator-map-wrap operator-map-wrap--test"
        data-testid="operator-map"
        aria-label="Harita test modu (WebGL yok)"
      >
        <ul className="operator-map__test-pins">
          {plottable.map((row) => (
            <li key={row.incidentId}>
              <button
                type="button"
                className={
                  selectedId === row.incidentId
                    ? 'operator-map__pin operator-map__pin--selected'
                    : 'operator-map__pin'
                }
                data-testid={`map-pin-${row.incidentId.slice(0, 8)}`}
                aria-label={`Vaka öncelik ${row.priority}`}
                onClick={() => onSelect(row.incidentId)}
              >
                {row.priority}
              </button>
              <span
                className="operator-map__test-accuracy"
                data-testid={`map-accuracy-${row.incidentId.slice(0, 8)}`}
              >
                ±{row.accuracyMeters ?? 'unknown'}m
              </span>
            </li>
          ))}
        </ul>
        <p className="operator-map__attribution">{osmAttribution()} (test modu)</p>
        {assignmentPreview ? (
          <p className="operator-map__preview" data-testid="assignment-map-preview">
            Görev önizleme: {assignmentPreview.teamLabel} → vaka (
            {assignmentPreview.to ? 'rota çizildi' : 'hedef koordinat yok'})
          </p>
        ) : null}
      </div>
    );
  }

  if (plottable.length === 0) {
    return (
      <div className="operator-map-wrap operator-map-wrap--empty" data-testid="operator-map">
        <div className="operator-map__empty-state">
          <div className="operator-map__empty-icon">🗺️</div>
          <h3 className="operator-map__empty-title">{t('web.cases.mapNoCases')}</h3>
          <p className="operator-map__empty-hint">{t('web.cases.mapNoCasesHint')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="operator-map-wrap operator-map-wrap--modern" data-testid="operator-map">
      <Map
        mapLib={maplibregl}
        initialViewState={{
          latitude: SYNTHETIC_MAP_CENTER.lat,
          longitude: SYNTHETIC_MAP_CENTER.lng,
          zoom: 6,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={resolveMapStyle() as maplibregl.StyleSpecification}
        onZoomEnd={(event) => onZoomChange(event.viewState.zoom)}
      >
        {clusters.map((feature) => {
          const [lng, lat] = feature.geometry.coordinates;
          const props = feature.properties as ClusterProps;
          if (props.cluster) {
            return (
              <Marker key={`cluster-${props.cluster_id}`} latitude={lat} longitude={lng} anchor="center">
                <button
                  type="button"
                  className="operator-map__cluster operator-map__cluster--modern"
                  aria-label={t('web.cases.mapLegendCluster').replace('{{count}}', props.point_count?.toString() || '0')}
                  onClick={() => {
                    if (props.cluster_id != null) {
                      onZoomChange(Math.min(index.getClusterExpansionZoom(props.cluster_id), 18));
                    }
                  }}
                >
                  {props.point_count}
                </button>
              </Marker>
            );
          }
          const row = props.incidentId ? rowByIncident.get(props.incidentId) : undefined;
          if (!row) {
            return null;
          }
          const radiusPx = metersToPixels(
            lat,
            accuracyCircleRadiusMeters(row.accuracyMeters),
            zoom
          );
          const opacity = accuracyVisualOpacity(row.accuracyMeters);
          const pinColor = getSeverityColor(row.priority);
          const isSelected = selectedId === row.incidentId;
          return (
            <Marker
              key={row.incidentId}
              latitude={lat}
              longitude={lng}
              anchor="center"
            >
              <div className="operator-map__marker-stack">
                <span
                  className="operator-map__accuracy"
                  style={{
                    width: radiusPx * 2,
                    height: radiusPx * 2,
                    opacity,
                  }}
                  aria-hidden
                />
                <button
                  type="button"
                  className={
                    isSelected
                      ? 'operator-map__pin operator-map__pin--modern operator-map__pin--selected'
                      : 'operator-map__pin operator-map__pin--modern'
                  }
                  style={{
                    backgroundColor: isSelected ? '#1d4ed8' : pinColor,
                  }}
                  aria-label={`Vaka öncelik ${row.priority}`}
                  data-testid={`map-pin-${row.incidentId.slice(0, 8)}`}
                  onClick={() => onSelect(row.incidentId)}
                >
                  {row.priority}
                </button>
              </div>
            </Marker>
          );
        })}
      </Map>
      
      <div className="operator-map__legend" data-testid="map-legend">
        <h3 className="operator-map__legend-title">{t('web.cases.mapLegendTitle')}</h3>
        <dl className="operator-map__legend-items">
          <div className="operator-map__legend-item">
            <dt>
              <span className="operator-map__legend-pin" style={{ backgroundColor: '#dc2626' }} />
            </dt>
            <dd>{t('web.cases.mapLegendCritical')} (P1)</dd>
          </div>
          <div className="operator-map__legend-item">
            <dt>
              <span className="operator-map__legend-pin" style={{ backgroundColor: '#ea580c' }} />
            </dt>
            <dd>{t('web.cases.mapLegendHigh')} (P2)</dd>
          </div>
          <div className="operator-map__legend-item">
            <dt>
              <span className="operator-map__legend-pin" style={{ backgroundColor: '#d97706' }} />
            </dt>
            <dd>{t('web.cases.mapLegendMedium')} (P3)</dd>
          </div>
          <div className="operator-map__legend-item">
            <dt>
              <span className="operator-map__legend-pin" style={{ backgroundColor: '#65a30d' }} />
            </dt>
            <dd>{t('web.cases.mapLegendLow')} (P4+)</dd>
          </div>
          <div className="operator-map__legend-item">
            <dt>
              <span className="operator-map__legend-pin operator-map__legend-pin--selected" />
            </dt>
            <dd>{t('web.cases.mapLegendSelected')}</dd>
          </div>
        </dl>
      </div>

      <p className="operator-map__attribution">{osmAttribution()}</p>
      {assignmentPreview ? (
        <p className="operator-map__preview" data-testid="assignment-map-preview">
          Görev önizleme: {assignmentPreview.teamLabel}
        </p>
      ) : null}
    </div>
  );
}

'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

import { useOperatorPreferences } from '../../../components/operator/OperatorPreferencesProvider';
import { CaseSection } from './CaseSection';
import {
  formatAccuracyMeters,
  formatCoordinate,
  formatCoordinatePair,
  interpolate,
  openStreetMapUrl,
} from './format';
import { Icon } from './icons';

const CaseMiniMap = dynamic(() => import('./CaseMiniMap'), {
  ssr: false,
  loading: () => <div className="cd2-map cd2-map--loading" aria-hidden="true" />,
});

type Props = {
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  approximate: boolean;
  locationStatus: string;
};

export function CaseLocationCard({
  latitude,
  longitude,
  accuracyMeters,
  approximate,
  locationStatus,
}: Props) {
  const { t } = useOperatorPreferences();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const accuracy = formatAccuracyMeters(accuracyMeters);
  const hasCoordinates = latitude !== null && longitude !== null;

  const copy = async () => {
    if (!hasCoordinates) return;
    const text = formatCoordinatePair(latitude, longitude);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1800);
  };

  return (
    <CaseSection title={t('web.cases.locationTitle')} icon="pin" testId="case-location-card">
      {hasCoordinates ? (
        <>
          <CaseMiniMap
            latitude={latitude}
            longitude={longitude}
            accuracyMeters={accuracyMeters}
            approximate={approximate}
            zoom={approximate ? 12 : 15}
            ariaLabel={t('web.cases.mapPreviewLabel')}
          />
          <dl className="cd2-facts">
            <div>
              <dt>{t('web.cases.tableHeaders.latitude')}</dt>
              <dd className="cd2-mono" data-testid="case-latitude">
                {formatCoordinate(latitude)}
              </dd>
            </div>
            <div>
              <dt>{t('web.cases.tableHeaders.longitude')}</dt>
              <dd className="cd2-mono" data-testid="case-longitude">
                {formatCoordinate(longitude)}
              </dd>
            </div>
            <div>
              <dt>{t('web.cases.accuracyLabel')}</dt>
              <dd data-testid="case-accuracy">
                {approximate
                  ? t('web.cases.locationApproximate')
                  : accuracy
                  ? interpolate(t('web.cases.accuracyValue'), { meters: accuracy })
                  : '—'}
              </dd>
            </div>
            <div>
              <dt>{t('web.cases.locationStatus')}</dt>
              <dd>{t(`web.locationStatuses.${locationStatus}`) || locationStatus}</dd>
            </div>
          </dl>
          <div className="cd2-actions">
            <button type="button" className="cd2-btn cd2-btn--ghost" onClick={copy} data-testid="case-copy-coords">
              <Icon name={copied ? 'check' : 'copy'} size={15} />
              <span aria-live="polite">
                {copied ? t('web.cases.coordinatesCopied') : t('web.cases.copyCoordinates')}
              </span>
            </button>
            <a
              className="cd2-btn cd2-btn--ghost"
              href={openStreetMapUrl(latitude, longitude)}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="case-open-in-map"
            >
              <Icon name="external" size={15} />
              {t('web.cases.openInMap')}
            </a>
          </div>
        </>
      ) : (
        <p className="cd2-empty">{t('web.cases.noCoordinates')}</p>
      )}
    </CaseSection>
  );
}

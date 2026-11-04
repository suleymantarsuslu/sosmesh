'use client';

import { useEffect, useRef, useState, type ComponentProps } from 'react';

import { useOperatorPreferences } from '../../../components/operator/OperatorPreferencesProvider';
import type { SparkVisionView } from '../../ai/types';
import type { OperatorAttachmentSummary } from '../types';
import { AnnotatedPhoto } from './AnnotatedPhoto';
import { CaseSection } from './CaseSection';
import { interpolate, segmentColor } from './format';
import { Icon } from './icons';
import { usePhotoMasks, useSparkSummaries } from './useAttachmentAnalysis';

const NO_SEGMENTS: ComponentProps<typeof AnnotatedPhoto>['segments'] = [];

type Props = {
  incidentId: string;
  photos: OperatorAttachmentSummary[];
  /** Latest Spark vision summary from the AI bundle (carries its attachment id). */
  sparkVision?: SparkVisionView | null;
};

function OverlayToggles({
  showBoxes,
  showMasks,
  onBoxes,
  onMasks,
  withTestIds,
}: {
  showBoxes: boolean;
  showMasks: boolean;
  onBoxes: (value: boolean) => void;
  onMasks: (value: boolean) => void;
  withTestIds: boolean;
}) {
  const { t } = useOperatorPreferences();
  return (
    <div className="cd2-toggles" role="group" aria-label={t('web.cases.overlayLegend')}>
      <label className={`cd2-chip-toggle ${showBoxes ? 'is-on' : ''}`}>
        <input
          type="checkbox"
          checked={showBoxes}
          onChange={(event) => onBoxes(event.target.checked)}
          data-testid={withTestIds ? 'ai-toggle-boxes' : undefined}
        />
        {t('web.ai.toggleBoxes')}
      </label>
      <label className={`cd2-chip-toggle ${showMasks ? 'is-on' : ''}`}>
        <input
          type="checkbox"
          checked={showMasks}
          onChange={(event) => onMasks(event.target.checked)}
          data-testid={withTestIds ? 'ai-toggle-masks' : undefined}
        />
        {t('web.ai.toggleMasks')}
      </label>
    </div>
  );
}

function Lightbox({
  src,
  alt,
  segments,
  showBoxes,
  showMasks,
  onBoxes,
  onMasks,
  onClose,
}: {
  src: string;
  alt: string;
  segments: ComponentProps<typeof AnnotatedPhoto>['segments'];
  showBoxes: boolean;
  showMasks: boolean;
  onBoxes: (value: boolean) => void;
  onMasks: (value: boolean) => void;
  onClose: () => void;
}) {
  const { t } = useOperatorPreferences();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      className="cd2-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      data-testid="case-photo-lightbox"
      onClick={onClose}
    >
      <div className="cd2-lightbox__panel" onClick={(event) => event.stopPropagation()}>
        <div className="cd2-lightbox__bar">
          {segments.length > 0 ? (
            <OverlayToggles
              showBoxes={showBoxes}
              showMasks={showMasks}
              onBoxes={onBoxes}
              onMasks={onMasks}
              withTestIds={false}
            />
          ) : (
            <span />
          )}
          <button
            ref={closeRef}
            type="button"
            className="cd2-btn cd2-btn--ghost"
            onClick={onClose}
            aria-label={t('web.cases.closePhoto')}
            data-testid="case-photo-lightbox-close"
          >
            <Icon name="close" size={16} />
            {t('web.cases.closePhoto')}
          </button>
        </div>
        <div className="cd2-lightbox__stage">
          <AnnotatedPhoto
            src={src}
            alt={alt}
            segments={segments}
            showBoxes={showBoxes}
            showMasks={showMasks}
            className="cd2-photo--large"
          />
        </div>
      </div>
    </div>
  );
}

export function CasePhotoGallery({ incidentId, photos, sparkVision = null }: Props) {
  const { t } = useOperatorPreferences();
  const [selected, setSelected] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [showBoxes, setShowBoxes] = useState(true);
  const [showMasks, setShowMasks] = useState(true);

  const photo = photos[Math.min(selected, photos.length - 1)];
  const analysisDone = photo.visionStatus === 'completed';
  const { state: maskState, retry } = usePhotoMasks(photo.id, analysisDone);
  const needsListFallback = photos.some(
    (p) => p.visionStatus === 'completed' && p.id !== sparkVision?.attachmentId
  );
  const spark = useSparkSummaries(incidentId, needsListFallback);

  const segments = maskState.status === 'ready' ? maskState.data.segments : NO_SEGMENTS;
  const hasMaskPixels = segments.some((segment) => segment.maskPng);
  const src = `/api/operator/attachments/${photo.id}/image`;
  const alt = interpolate(t('web.cases.photoOf'), { index: selected + 1, total: photos.length });
  const bundleSpark = sparkVision && sparkVision.attachmentId === photo.id ? sparkVision.summary : null;
  const summary =
    bundleSpark?.description ?? (spark.status === 'ready' ? spark.byAttachment[photo.id] ?? null : null);

  return (
    <CaseSection
      title={t('web.cases.photosTitle')}
      icon="image"
      testId="case-photos-card"
      actions={
        photos.length > 1 ? (
          <span className="cd2-count">{photos.length}</span>
        ) : undefined
      }
    >
      <div className="cd2-gallery">
        <div className="cd2-gallery__stage" data-testid="ai-photo-card">
          <AnnotatedPhoto
            src={src}
            alt={alt}
            segments={segments}
            showBoxes={showBoxes}
            showMasks={showMasks}
            imageTestId="ai-photo-image"
            canvasTestId="ai-photo-canvas"
          />
          <button
            type="button"
            className="cd2-gallery__enlarge"
            onClick={() => setLightbox(true)}
            aria-label={t('web.cases.enlargePhoto')}
            title={t('web.cases.enlargePhoto')}
            data-testid="case-photo-enlarge"
          >
            <Icon name="expand" size={16} />
          </button>
        </div>

        {photos.length > 1 ? (
          <ul className="cd2-gallery__thumbs">
            {photos.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`cd2-gallery__thumb ${index === selected ? 'is-active' : ''}`}
                  onClick={() => setSelected(index)}
                  aria-label={interpolate(t('web.cases.photoOf'), {
                    index: index + 1,
                    total: photos.length,
                  })}
                  aria-pressed={index === selected}
                >
                  <img src={`/api/operator/attachments/${item.id}/image`} alt="" loading="lazy" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="cd2-vision" data-testid="case-vision-analysis" aria-live="polite">
          <h3 className="cd2-subtitle">{t('web.ai.photoAnalysisTitle')}</h3>

          {photo.visionStatus === 'failed' || (analysisDone && maskState.status === 'failed') ? (
            <div className="cd2-state cd2-state--error" role="alert" data-testid="vision-failed">
              <Icon name="alert" size={16} />
              <span>
                {photo.visionStatus === 'failed'
                  ? t('web.cases.aiAnalysisFailed')
                  : t('web.cases.visionFailed')}
              </span>
              {analysisDone ? (
                <button type="button" className="cd2-btn cd2-btn--ghost" onClick={retry}>
                  {t('web.cases.retry')}
                </button>
              ) : null}
            </div>
          ) : photo.visionStatus === 'pending' || photo.visionStatus === 'processing' ? (
            <div className="cd2-state" data-testid="vision-pending">
              <span className="cd2-spinner" aria-hidden="true" />
              <span>
                {photo.visionStatus === 'pending'
                  ? t('web.cases.aiAnalysisPending')
                  : t('web.cases.aiAnalysisProcessing')}
                {' · '}
                {t('web.cases.visionPendingHint')}
              </span>
            </div>
          ) : !analysisDone ? (
            <p className="cd2-empty" data-testid="vision-empty">
              {t('web.cases.visionEmpty')}
            </p>
          ) : (
            <>
              {!summary && needsListFallback && spark.status === 'loading' ? (
                <div className="cd2-skeleton" aria-label={t('web.cases.visionLoading')}>
                  <span />
                  <span />
                </div>
              ) : summary ? (
                <p className="cd2-prose" data-testid="ai-spark-summary">
                  {summary}
                </p>
              ) : (
                <p className="cd2-muted">
                  {needsListFallback && spark.status === 'failed'
                    ? t('web.cases.visionFailed')
                    : t('web.cases.visionSummaryEmpty')}
                </p>
              )}

              {bundleSpark ? (
                <dl className="cd2-facts cd2-facts--stack" data-testid="vision-spark-details">
                  {bundleSpark.visibleObjects.length > 0 ? (
                    <div>
                      <dt>{t('web.ai.visibleObjects')}</dt>
                      <dd className="cd2-chips">
                        {bundleSpark.visibleObjects.map((item) => (
                          <span key={item} className="cd2-chip">
                            {item}
                          </span>
                        ))}
                      </dd>
                    </div>
                  ) : null}
                  {bundleSpark.hazardsVisible.length > 0 ? (
                    <div>
                      <dt>{t('web.ai.hazardsVisible')}</dt>
                      <dd className="cd2-chips">
                        {bundleSpark.hazardsVisible.map((item) => (
                          <span key={item} className="cd2-chip cd2-chip--hazard">
                            {item}
                          </span>
                        ))}
                      </dd>
                    </div>
                  ) : null}
                  {bundleSpark.estimatedPersonCount !== null ? (
                    <div>
                      <dt>{t('web.ai.estimatedPersons')}</dt>
                      <dd>{bundleSpark.estimatedPersonCount}</dd>
                    </div>
                  ) : null}
                  {bundleSpark.possiblePeopleIndicators ? (
                    <div>
                      <dt>{t('web.cases.visionPeopleIndicators')}</dt>
                      <dd>{bundleSpark.possiblePeopleIndicators}</dd>
                    </div>
                  ) : null}
                  {bundleSpark.accessIssues && bundleSpark.accessIssues.length > 0 ? (
                    <div>
                      <dt>{t('web.cases.visionAccessIssues')}</dt>
                      <dd>{bundleSpark.accessIssues.join(', ')}</dd>
                    </div>
                  ) : null}
                  {bundleSpark.uncertainty ? (
                    <div>
                      <dt>{t('web.cases.visionUncertainty')}</dt>
                      <dd>{bundleSpark.uncertainty}</dd>
                    </div>
                  ) : null}
                  {bundleSpark.confidence ? (
                    <div>
                      <dt>{t('web.cases.visionConfidence')}</dt>
                      <dd>{t(`web.cases.confidence.${bundleSpark.confidence}`)}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}

              {maskState.status === 'loading' ? (
                <div className="cd2-state">
                  <span className="cd2-spinner" aria-hidden="true" />
                  <span>{t('web.cases.visionLoading')}</span>
                </div>
              ) : null}

              {maskState.status === 'empty' ? (
                <p className="cd2-muted" data-testid="vision-masks-unavailable">
                  {t('web.cases.maskOverlayUnavailable')}
                </p>
              ) : null}

              {maskState.status === 'ready' ? (
                segments.length === 0 ? (
                  <p className="cd2-muted">{t('web.cases.noDetectedObjects')}</p>
                ) : (
                  <>
                    <OverlayToggles
                      showBoxes={showBoxes}
                      showMasks={showMasks}
                      onBoxes={setShowBoxes}
                      onMasks={setShowMasks}
                      withTestIds
                    />
                    {!hasMaskPixels ? (
                      <p className="cd2-muted">{t('web.cases.maskOverlayUnavailable')}</p>
                    ) : null}
                    <h4 className="cd2-subtitle cd2-subtitle--sm">{t('web.cases.detectedObjects')}</h4>
                    <ul className="cd2-legend" data-testid="vision-segments">
                      {segments.map((segment, index) => (
                        <li key={segment.id}>
                          <span
                            className="cd2-legend__dot"
                            style={{ backgroundColor: segmentColor(index) }}
                            aria-hidden="true"
                          />
                          <span>{segment.concept}</span>
                          {segment.confidence !== null && segment.confidence !== undefined ? (
                            <span className="cd2-legend__pct">
                              {Math.round(segment.confidence * 100)}%
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </>
                )
              ) : null}
            </>
          )}
          <p className="cd2-disclaimer">{t('web.cases.aiOnlySuggests')}</p>
        </div>
      </div>

      {lightbox ? (
        <Lightbox
          src={src}
          alt={alt}
          segments={segments}
          showBoxes={showBoxes}
          showMasks={showMasks}
          onBoxes={setShowBoxes}
          onMasks={setShowMasks}
          onClose={() => setLightbox(false)}
        />
      ) : null}
    </CaseSection>
  );
}
